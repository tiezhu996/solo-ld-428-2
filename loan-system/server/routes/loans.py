# -*- coding: utf-8 -*-
"""借展单 API —— 核心模块，含展期冲突事务校验与状态机。"""
import datetime

from db import get_conn
from web import route, ApiError
from helpers import (
    rows_to_dicts, row_to_dict, require, insert, update_by_id,
    parse_date, gen_loan_no, conflict_check,
)

EDITABLE_STATUSES = ("pending",)          # 待出库可完整编辑
DATE_EDITABLE_STATUSES = ("pending", "outgoing", "active")  # 进行中仅可调日期


def _load_artwork_ids(conn, loan_id):
    rows = conn.execute(
        "SELECT artwork_id FROM loan_artwork WHERE loan_id=?", (loan_id,)
    ).fetchall()
    return [r["artwork_id"] for r in rows]


def load_loan_detail(conn, loan_id):
    """组装借展单详情：基础信息 + 机构 + 作品 + 保单 + 装箱 + 交接 + 归还检查。"""
    loan = conn.execute(
        """SELECT l.*, i.name AS institution_name, i.contact AS institution_contact,
                  i.phone AS institution_phone
           FROM loan l JOIN institution i ON i.id = l.institution_id
           WHERE l.id=?""",
        (loan_id,),
    ).fetchone()
    if not loan:
        raise ApiError(404, "借展单不存在")
    d = row_to_dict(loan)

    artworks = conn.execute(
        """SELECT a.id, a.accession_no, a.title, a.artist, a.dimensions,
                  a.condition_note
           FROM loan_artwork la JOIN artwork a ON a.id = la.artwork_id
           WHERE la.loan_id=? ORDER BY a.accession_no""",
        (loan_id,),
    ).fetchall()
    d["artworks"] = rows_to_dicts(artworks)

    policy = conn.execute(
        "SELECT * FROM insurance_policy WHERE loan_id=?", (loan_id,)
    ).fetchone()
    d["insurance"] = row_to_dict(policy)

    crates = conn.execute(
        "SELECT * FROM crate WHERE loan_id=? ORDER BY crate_no", (loan_id,)
    ).fetchall()
    d["crates"] = []
    for c in crates:
        crate = row_to_dict(c)
        items = conn.execute(
            """SELECT pi.*, a.accession_no, a.title
               FROM packing_item pi JOIN artwork a ON a.id = pi.artwork_id
               WHERE pi.crate_id=? ORDER BY a.accession_no""",
            (c["id"],),
        ).fetchall()
        crate["items"] = rows_to_dicts(items)
        d["crates"].append(crate)

    handovers = conn.execute(
        "SELECT * FROM handover WHERE loan_id=? ORDER BY handover_date, id",
        (loan_id,),
    ).fetchall()
    d["handovers"] = []
    for h in handovers:
        ho = row_to_dict(h)
        items = conn.execute(
            """SELECT hi.*, a.accession_no, a.title
               FROM handover_item hi JOIN artwork a ON a.id = hi.artwork_id
               WHERE hi.handover_id=? ORDER BY a.accession_no""",
            (h["id"],),
        ).fetchall()
        ho["items"] = rows_to_dicts(items)
        d["handovers"].append(ho)

    check = conn.execute(
        "SELECT * FROM return_check WHERE loan_id=?", (loan_id,)
    ).fetchone()
    if check:
        rc = row_to_dict(check)
        items = conn.execute(
            """SELECT rci.*, a.accession_no, a.title
               FROM return_check_item rci JOIN artwork a ON a.id = rci.artwork_id
               WHERE rci.check_id=? ORDER BY a.accession_no""",
            (check["id"],),
        ).fetchall()
        rc["items"] = rows_to_dicts(items)
        d["return_check"] = rc
    else:
        d["return_check"] = None

    # 派生状态与提醒
    today = datetime.date.today()
    end = parse_date(d["end_date"], "结束日期")
    if d["status"] in ("active", "outgoing", "pending") and end < today:
        d["derived_status"] = "overdue"
    else:
        d["derived_status"] = d["status"]
    d["days_remaining"] = (end - today).days
    return d


@route("GET", "/api/loans")
def list_loans(body, params, query):
    conn = get_conn()
    rows = conn.execute(
        """SELECT l.*, i.name AS institution_name,
                  (SELECT COUNT(*) FROM loan_artwork la WHERE la.loan_id=l.id) AS artwork_count
           FROM loan l JOIN institution i ON i.id = l.institution_id
           ORDER BY l.created_at DESC"""
    ).fetchall()
    today = datetime.date.today().isoformat()
    items = []
    for r in rows:
        item = row_to_dict(r)
        if item["status"] in ("pending", "outgoing", "active") and item["end_date"] < today:
            item["derived_status"] = "overdue"
        else:
            item["derived_status"] = item["status"]
        items.append(item)
    status_filter = query.get("status")
    if status_filter:
        items = [x for x in items if x["derived_status"] == status_filter]
    conn.close()
    return {"items": items}


@route("GET", "/api/loans/{id}")
def get_loan(body, params, query):
    conn = get_conn()
    detail = load_loan_detail(conn, params["id"])
    conn.close()
    return detail


@route("POST", "/api/loans")
def create_loan(body, params, query):
    institution_id = require(body, [("institution_id", "借展机构")])["institution_id"]
    start = parse_date(body.get("start_date"), "借展开始日期")
    end = parse_date(body.get("end_date"), "借展结束日期")
    if end < start:
        raise ApiError(400, "结束日期不能早于开始日期")
    artwork_ids = body.get("artwork_ids") or []
    if not artwork_ids:
        raise ApiError(400, "请至少选择一件借出作品")
    try:
        artwork_ids = [int(x) for x in artwork_ids]
    except (TypeError, ValueError):
        raise ApiError(400, "作品参数不合法")

    conn = get_conn()
    try:
        # 事务 + IMMEDIATE 锁，保证并发下冲突校验与写入的原子性
        conn.execute("BEGIN IMMEDIATE")
        inst = conn.execute(
            "SELECT id FROM institution WHERE id=?", (institution_id,)
        ).fetchone()
        if not inst:
            raise ApiError(400, "借展机构不存在")
        for aid in artwork_ids:
            art = conn.execute("SELECT id,title FROM artwork WHERE id=?", (aid,)).fetchone()
            if not art:
                raise ApiError(400, f"作品 id={aid} 不存在")

        conflicts = []
        for aid in artwork_ids:
            hit = conflict_check(conn, aid, start, end)
            if hit:
                art = conn.execute("SELECT title FROM artwork WHERE id=?", (aid,)).fetchone()
                conflicts.append({"artwork_id": aid, "artwork_title": art["title"], **hit})
        if conflicts:
            raise ApiError(409, "存在展期冲突，提交已阻止", {"conflicts": conflicts})

        if body.get("dry_run"):
            # 预检模式：只做校验不落库
            conn.rollback()
            conn.close()
            return {"valid": True, "artwork_count": len(artwork_ids)}

        loan_id = insert(conn, "loan", {
            "loan_no": gen_loan_no(conn),
            "institution_id": institution_id,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "venue": body.get("venue", ""),
            "purpose": body.get("purpose", ""),
            "notes": body.get("notes", ""),
            "status": "pending",
            "created_at": datetime.datetime.now().isoformat(timespec="seconds"),
        })
        conn.executemany(
            "INSERT INTO loan_artwork (loan_id, artwork_id) VALUES (?,?)",
            [(loan_id, aid) for aid in artwork_ids],
        )
        conn.commit()
    except ApiError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"id": loan_id}


@route("PUT", "/api/loans/{id}")
def update_loan(body, params, query):
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        loan = conn.execute("SELECT * FROM loan WHERE id=?", (params["id"],)).fetchone()
        if not loan:
            raise ApiError(404, "借展单不存在")
        if loan["status"] not in DATE_EDITABLE_STATUSES:
            raise ApiError(409, f"状态为 {loan['status']} 的借展单不可编辑")

        data = {}
        for field in ("venue", "purpose", "notes", "institution_id"):
            if field in body:
                data[field] = body[field]

        start = parse_date(body.get("start_date", loan["start_date"]), "开始日期")
        end = parse_date(body.get("end_date", loan["end_date"]), "结束日期")
        if end < start:
            raise ApiError(400, "结束日期不能早于开始日期")
        data["start_date"] = start.isoformat()
        data["end_date"] = end.isoformat()

        if loan["status"] not in EDITABLE_STATUSES and body.get("artwork_ids") is not None:
            raise ApiError(409, "借展单已出库，不能增减作品；如需调整请新建借展单")

        artwork_ids = body.get("artwork_ids")
        if artwork_ids is not None:
            try:
                artwork_ids = [int(x) for x in artwork_ids]
            except (TypeError, ValueError):
                raise ApiError(400, "作品参数不合法")
            if not artwork_ids:
                raise ApiError(400, "请至少选择一件借出作品")

            conflicts = []
            for aid in artwork_ids:
                if not conn.execute("SELECT 1 FROM artwork WHERE id=?", (aid,)).fetchone():
                    raise ApiError(400, f"作品 id={aid} 不存在")
                hit = conflict_check(conn, aid, start, end, exclude_loan_id=loan["id"])
                if hit:
                    art = conn.execute("SELECT title FROM artwork WHERE id=?", (aid,)).fetchone()
                    conflicts.append({"artwork_id": aid, "artwork_title": art["title"], **hit})
            if conflicts:
                raise ApiError(409, "存在展期冲突，保存已阻止", {"conflicts": conflicts})

            conn.execute("DELETE FROM loan_artwork WHERE loan_id=?", (params["id"],))
            conn.executemany(
                "INSERT INTO loan_artwork (loan_id, artwork_id) VALUES (?,?)",
                [(params["id"], aid) for aid in artwork_ids],
            )

        if body.get("dry_run"):
            conn.rollback()
            conn.close()
            return {"valid": True}

        update_by_id(conn, "loan", params["id"], data)
        conn.commit()
    except ApiError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"ok": True}


@route("POST", "/api/loans/{id}/cancel")
def cancel_loan(body, params, query):
    conn = get_conn()
    loan = conn.execute("SELECT * FROM loan WHERE id=?", (params["id"],)).fetchone()
    if not loan:
        conn.close()
        raise ApiError(404, "借展单不存在")
    if loan["status"] != "pending":
        conn.close()
        raise ApiError(409, "只有待出库的借展单可以取消")
    conn.execute("UPDATE loan SET status='cancelled' WHERE id=?", (params["id"],))
    conn.commit()
    conn.close()
    return {"ok": True}
