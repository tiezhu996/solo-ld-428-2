# -*- coding: utf-8 -*-
"""交接记录 API：出库 / 到馆 / 还回出库 / 回库，逐件登记状况，驱动借展状态机。"""
import datetime

from db import get_conn
from web import route, ApiError
from helpers import require, parse_date, insert, rows_to_dicts, row_to_dict

HANDOVER_TYPES = {
    "outbound": "出库交接",
    "arrived": "到馆交接",
    "return_outbound": "还回出库",
    "return_inbound": "回库交接",
}
CONDITIONS = {"good": "完好", "damaged": "损伤", "missing": "缺失"}

# 各交接类型允许的借展当前状态
TYPE_FROM_STATUS = {
    "outbound": ("pending", "outgoing", "active"),
    "arrived": ("outgoing", "active"),
    "return_outbound": ("active",),
    "return_inbound": ("active",),
}


def _validate_items(conn, loan_id, items):
    """校验交接作品清单：必须覆盖且仅覆盖借展作品，状况值合法。"""
    if not items:
        raise ApiError(400, "请逐件登记交接作品的状况")
    loan_art_ids = {
        r["artwork_id"]
        for r in conn.execute(
            "SELECT artwork_id FROM loan_artwork WHERE loan_id=?", (loan_id,)
        ).fetchall()
    }
    seen = set()
    normalized = []
    for it in items:
        try:
            aid = int(it.get("artwork_id"))
        except (TypeError, ValueError):
            raise ApiError(400, "作品参数不合法")
        if aid not in loan_art_ids:
            raise ApiError(400, f"作品 id={aid} 不在本借展单中")
        if aid in seen:
            raise ApiError(400, f"作品 id={aid} 重复登记")
        seen.add(aid)
        cond = it.get("condition_status")
        if cond not in CONDITIONS:
            raise ApiError(400, f"作品 id={aid} 的状况值不合法")
        normalized.append((aid, cond, (it.get("condition_note") or "").strip()))
    missing = loan_art_ids - seen
    if missing:
        raise ApiError(400, f"还有 {len(missing)} 件作品未登记交接状况，不允许提交")
    return normalized


@route("GET", "/api/loans/{id}/handovers")
def list_handovers(body, params, query):
    conn = get_conn()
    if not conn.execute("SELECT 1 FROM loan WHERE id=?", (params["id"],)).fetchone():
        raise ApiError(404, "借展单不存在")
    rows = conn.execute(
        "SELECT * FROM handover WHERE loan_id=? ORDER BY handover_date, id",
        (params["id"],),
    ).fetchall()
    result = []
    for h in rows:
        ho = row_to_dict(h)
        items = conn.execute(
            """SELECT hi.*, a.accession_no, a.title
               FROM handover_item hi JOIN artwork a ON a.id=hi.artwork_id
               WHERE hi.handover_id=? ORDER BY a.accession_no""",
            (h["id"],),
        ).fetchall()
        ho["items"] = rows_to_dicts(items)
        result.append(ho)
    conn.close()
    return {"items": result}


@route("POST", "/api/loans/{id}/handovers")
def create_handover(body, params, query):
    htype = body.get("type")
    if htype not in HANDOVER_TYPES:
        raise ApiError(400, "交接类型不合法")
    hdate = parse_date(body.get("handover_date"), "交接日期")

    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        loan = conn.execute("SELECT * FROM loan WHERE id=?", (params["id"],)).fetchone()
        if not loan:
            raise ApiError(404, "借展单不存在")
        if loan["status"] not in TYPE_FROM_STATUS[htype]:
            allowed = "、".join(TYPE_FROM_STATUS[htype])
            raise ApiError(
                409,
                f"当前借展状态为 {loan['status']}，不允许登记{HANDOVER_TYPES[htype]}"
                f"（要求状态：{allowed}）",
            )

        # 同一类型不允许重复登记（出库/到馆/还回出库/回库各一次）
        dup = conn.execute(
            "SELECT id FROM handover WHERE loan_id=? AND type=?",
            (params["id"], htype),
        ).fetchone()
        if dup:
            raise ApiError(409, f"{HANDOVER_TYPES[htype]}已登记，不能重复；如需修改请联系管理员")

        items = _validate_items(conn, params["id"], body.get("items") or [])

        handover_id = insert(conn, "handover", {
            "loan_id": int(params["id"]),
            "type": htype,
            "handover_date": hdate.isoformat(),
            "from_party": body.get("from_party", ""),
            "to_party": body.get("to_party", ""),
            "shipper": body.get("shipper", ""),
            "receiver": body.get("receiver", ""),
            "note": body.get("note", ""),
            "created_at": datetime.datetime.now().isoformat(timespec="seconds"),
        })
        conn.executemany(
            """INSERT INTO handover_item
               (handover_id, artwork_id, condition_status, condition_note)
               VALUES (?,?,?,?)""",
            [(handover_id, aid, cond, note) for aid, cond, note in items],
        )

        # 状态机推进
        new_status = None
        if htype == "outbound" and loan["status"] == "pending":
            new_status = "outgoing"
        elif htype == "arrived" and loan["status"] == "outgoing":
            new_status = "active"
        if new_status:
            conn.execute("UPDATE loan SET status=? WHERE id=?", (new_status, params["id"]))
        conn.commit()
    except ApiError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"id": handover_id}
