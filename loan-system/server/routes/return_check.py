# -*- coding: utf-8 -*-
"""归还检查 API：逐件核对归还状况，全部核对后结项（借展单 -> 已归还）。"""
import datetime

from db import get_conn
from web import route, ApiError
from helpers import require, parse_date, insert, update_by_id, rows_to_dicts, row_to_dict

CONDITIONS = {"good": "完好", "damaged": "损伤", "missing": "缺失"}


def _load_check(conn, loan_id):
    check = conn.execute(
        "SELECT * FROM return_check WHERE loan_id=?", (loan_id,)
    ).fetchone()
    if not check:
        return None
    rc = row_to_dict(check)
    items = conn.execute(
        """SELECT rci.*, a.accession_no, a.title
           FROM return_check_item rci JOIN artwork a ON a.id=rci.artwork_id
           WHERE rci.check_id=? ORDER BY a.accession_no""",
        (check["id"],),
    ).fetchall()
    rc["items"] = rows_to_dicts(items)
    return rc


@route("GET", "/api/loans/{id}/return-check")
def get_return_check(body, params, query):
    conn = get_conn()
    loan = conn.execute("SELECT * FROM loan WHERE id=?", (params["id"],)).fetchone()
    if not loan:
        raise ApiError(404, "借展单不存在")
    check = _load_check(conn, params["id"])
    loan_artworks = conn.execute(
        """SELECT a.id, a.accession_no, a.title, a.condition_note
           FROM loan_artwork la JOIN artwork a ON a.id=la.artwork_id
           WHERE la.loan_id=? ORDER BY a.accession_no""",
        (params["id"],),
    ).fetchall()
    conn.close()
    return {
        "check": check,
        "loan_artworks": rows_to_dicts(loan_artworks),
    }


def _ensure_check(conn, loan_id, body):
    check = conn.execute(
        "SELECT * FROM return_check WHERE loan_id=?", (loan_id,)
    ).fetchone()
    if check:
        return check
    check_date = parse_date(body.get("check_date"), "检查日期")
    insert_id = insert(conn, "return_check", {
        "loan_id": int(loan_id),
        "check_date": check_date.isoformat(),
        "inspector": body.get("inspector", ""),
        "location": body.get("location", ""),
        "summary": body.get("summary", ""),
        "finalized": 0,
    })
    return conn.execute("SELECT * FROM return_check WHERE id=?", (insert_id,)).fetchone()


@route("PUT", "/api/loans/{id}/return-check")
def save_return_check(body, params, query):
    """保存检查单头信息与单件核对结果（可多次保存）。"""
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        loan = conn.execute("SELECT * FROM loan WHERE id=?", (params["id"],)).fetchone()
        if not loan:
            raise ApiError(404, "借展单不存在")
        if loan["status"] == "cancelled":
            raise ApiError(409, "借展单已取消")
        check = _ensure_check(conn, params["id"], body)
        if check["finalized"]:
            raise ApiError(409, "归还检查已结项，不可再修改")

        header = {}
        if "check_date" in body:
            header["check_date"] = parse_date(body["check_date"], "检查日期").isoformat()
        for f in ("inspector", "location", "summary"):
            if f in body:
                header[f] = body[f]
        if header:
            update_by_id(conn, "return_check", check["id"], header)

        if "items" in body:
            loan_ids = {
                r["artwork_id"]
                for r in conn.execute(
                    "SELECT artwork_id FROM loan_artwork WHERE loan_id=?", (params["id"],)
                ).fetchall()
            }
            seen = set()
            for it in body["items"]:
                try:
                    aid = int(it.get("artwork_id"))
                except (TypeError, ValueError):
                    raise ApiError(400, "作品参数不合法")
                if aid not in loan_ids:
                    raise ApiError(400, f"作品 id={aid} 不在本借展单中")
                seen.add(aid)
                cond = it.get("condition_status")
                if cond not in CONDITIONS:
                    raise ApiError(400, f"作品 id={aid} 的归还状况不合法")
                data = {
                    "condition_status": cond,
                    "condition_note": (it.get("condition_note") or "").strip(),
                    "action": (it.get("action") or "").strip(),
                }
                existing = conn.execute(
                    "SELECT id FROM return_check_item WHERE check_id=? AND artwork_id=?",
                    (check["id"], aid),
                ).fetchone()
                if existing:
                    update_by_id(conn, "return_check_item", existing["id"], data)
                else:
                    data["check_id"] = check["id"]
                    data["artwork_id"] = aid
                    insert(conn, "return_check_item", data)
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


@route("POST", "/api/loans/{id}/return-check/finalize")
def finalize_return_check(body, params, query):
    """核对完整性校验通过后结项：借展单置为已归还。"""
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        loan = conn.execute("SELECT * FROM loan WHERE id=?", (params["id"],)).fetchone()
        if not loan:
            raise ApiError(404, "借展单不存在")
        if loan["status"] not in ("active", "outgoing", "pending"):
            raise ApiError(409, f"状态为 {loan['status']} 的借展单不能执行归还结项")
        check = conn.execute(
            "SELECT * FROM return_check WHERE loan_id=?", (params["id"],)
        ).fetchone()
        if not check:
            raise ApiError(400, "请先逐件核对归还状况后再结项")
        if check["finalized"]:
            raise ApiError(409, "已完成结项")

        loan_ids = [
            r["artwork_id"]
            for r in conn.execute(
                "SELECT artwork_id FROM loan_artwork WHERE loan_id=?", (params["id"],)
            ).fetchall()
        ]
        checked = {
            r["artwork_id"]: r
            for r in conn.execute(
                "SELECT * FROM return_check_item WHERE check_id=?", (check["id"],)
            ).fetchall()
        }
        unchecked = [aid for aid in loan_ids if aid not in checked]
        if unchecked:
            titles = []
            for aid in unchecked:
                t = conn.execute("SELECT accession_no FROM artwork WHERE id=?", (aid,)).fetchone()
                titles.append(t["accession_no"] if t else str(aid))
            raise ApiError(
                400,
                f"仍有 {len(unchecked)} 件作品未核对归还状况，不允许结项",
                {"unchecked_artworks": titles},
            )

        conn.execute("UPDATE return_check SET finalized=1 WHERE id=?", (check["id"],))
        conn.execute(
            "UPDATE loan SET status='returned', returned_at=? WHERE id=?",
            (check["check_date"], params["id"]),
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
    return {"ok": True}
