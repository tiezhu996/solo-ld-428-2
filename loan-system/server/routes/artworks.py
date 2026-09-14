# -*- coding: utf-8 -*-
"""藏品 API。"""
import datetime

from db import get_conn
from web import route, ApiError
from helpers import rows_to_dicts, row_to_dict, require, insert, update_by_id


def compute_status(conn, artwork, exclude_loan_id=None):
    """根据未完成借展动态计算作品状态（可借 / 已预约 / 在展）。"""
    row = conn.execute(
        """
        SELECT l.status, l.loan_no, l.start_date, l.end_date
        FROM loan_artwork la JOIN loan l ON l.id = la.loan_id
        WHERE la.artwork_id = ? AND l.status IN ('pending','outgoing','active')
        ORDER BY CASE l.status WHEN 'active' THEN 0 WHEN 'outgoing' THEN 1 ELSE 2 END,
                 l.start_date
        LIMIT 1
        """,
        (artwork["id"],),
    ).fetchone()
    if row:
        base = row["status"]
        artwork["status"] = (
            "on_loan" if base in ("active", "outgoing") else "reserved"
        )
        artwork["current_loan_no"] = row["loan_no"]
        artwork["current_start"] = row["start_date"]
        artwork["current_end"] = row["end_date"]
    else:
        artwork["status"] = "available"
        artwork["current_loan_no"] = None
    return artwork


@route("GET", "/api/artworks")
def list_artworks(body, params, query):
    conn = get_conn()
    keyword = (query.get("q") or "").strip()
    sql = "SELECT * FROM artwork"
    args = []
    if keyword:
        sql += " WHERE title LIKE ? OR accession_no LIKE ? OR artist LIKE ?"
        like = f"%{keyword}%"
        args = [like, like, like]
    sql += " ORDER BY accession_no"
    rows = conn.execute(sql, args).fetchall()
    result = [compute_status(conn, row_to_dict(r)) for r in rows]
    status_filter = query.get("status")
    if status_filter:
        result = [r for r in result if r["status"] == status_filter]
    conn.close()
    return {"items": result}


@route("GET", "/api/artworks/{id}")
def get_artwork(body, params, query):
    conn = get_conn()
    row = conn.execute("SELECT * FROM artwork WHERE id=?", (params["id"],)).fetchone()
    if not row:
        raise ApiError(404, "作品不存在")
    item = compute_status(conn, row_to_dict(row))
    history = conn.execute(
        """
        SELECT l.id, l.loan_no, l.start_date, l.end_date, l.status,
               i.name AS institution_name
        FROM loan_artwork la JOIN loan l ON l.id = la.loan_id
        JOIN institution i ON i.id = l.institution_id
        WHERE la.artwork_id=? ORDER BY l.start_date DESC
        """,
        (params["id"],),
    ).fetchall()
    item["loan_history"] = rows_to_dicts(history)
    conn.close()
    return item


@route("POST", "/api/artworks")
def create_artwork(body, params, query):
    vals = require(body, [("accession_no", "馆藏编号"), ("title", "作品标题")])
    conn = get_conn()
    try:
        new_id = insert(conn, "artwork", {
            "accession_no": vals["accession_no"],
            "title": vals["title"],
            "artist": body.get("artist", ""),
            "year": str(body.get("year", "")),
            "medium": body.get("medium", ""),
            "dimensions": body.get("dimensions", ""),
            "location": body.get("location", ""),
            "condition_note": body.get("condition_note", ""),
            "created_at": datetime.datetime.now().isoformat(timespec="seconds"),
        })
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if "UNIQUE" in str(exc):
            raise ApiError(409, f"馆藏编号 {vals['accession_no']} 已存在")
        raise
    finally:
        conn.close()
    return {"id": new_id}


@route("PUT", "/api/artworks/{id}")
def update_artwork(body, params, query):
    conn = get_conn()
    row = conn.execute("SELECT id FROM artwork WHERE id=?", (params["id"],)).fetchone()
    if not row:
        raise ApiError(404, "作品不存在")
    fields = ["title", "artist", "year", "medium", "dimensions",
              "location", "condition_note", "accession_no"]
    data = {k: body[k] for k in fields if k in body}
    try:
        update_by_id(conn, "artwork", params["id"], data)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if "UNIQUE" in str(exc):
            raise ApiError(409, "馆藏编号重复")
        raise
    finally:
        conn.close()
    return {"ok": True}


@route("DELETE", "/api/artworks/{id}")
def delete_artwork(body, params, query):
    conn = get_conn()
    row = conn.execute("SELECT id FROM artwork WHERE id=?", (params["id"],)).fetchone()
    if not row:
        raise ApiError(404, "作品不存在")
    using = conn.execute(
        """SELECT l.loan_no FROM loan_artwork la JOIN loan l ON l.id=la.loan_id
           WHERE la.artwork_id=? AND l.status != 'cancelled' LIMIT 1""",
        (params["id"],),
    ).fetchone()
    if using:
        raise ApiError(409, f"该作品存在有效借展单 {using['loan_no']}，无法删除")
    try:
        conn.execute("DELETE FROM artwork WHERE id=?", (params["id"],))
        conn.commit()
    except Exception:
        conn.rollback()
        raise ApiError(409, "该作品已被装箱/交接记录引用，无法删除（可保留仅作存档）")
    finally:
        conn.close()
    return {"ok": True}
