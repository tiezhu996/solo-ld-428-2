# -*- coding: utf-8 -*-
"""借展机构 API。"""
import datetime

from db import get_conn
from web import route, ApiError
from helpers import rows_to_dicts, require, insert, update_by_id


@route("GET", "/api/institutions")
def list_institutions(body, params, query):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT i.*, COUNT(l.id) AS loan_count,
          SUM(CASE WHEN l.status IN ('pending','outgoing','active') THEN 1 ELSE 0 END)
            AS active_count
        FROM institution i LEFT JOIN loan l ON l.institution_id = i.id
        GROUP BY i.id ORDER BY i.name
        """
    ).fetchall()
    items = rows_to_dicts(rows)
    conn.close()
    return {"items": items}


@route("POST", "/api/institutions")
def create_institution(body, params, query):
    vals = require(body, [("name", "机构名称")])
    conn = get_conn()
    dup = conn.execute("SELECT id FROM institution WHERE name=?", (vals["name"],)).fetchone()
    if dup:
        conn.close()
        raise ApiError(409, f"机构 {vals['name']} 已存在")
    new_id = insert(conn, "institution", {
        "name": vals["name"],
        "contact": body.get("contact", ""),
        "phone": body.get("phone", ""),
        "email": body.get("email", ""),
        "address": body.get("address", ""),
        "note": body.get("note", ""),
        "created_at": datetime.datetime.now().isoformat(timespec="seconds"),
    })
    conn.commit()
    conn.close()
    return {"id": new_id}


@route("PUT", "/api/institutions/{id}")
def update_institution(body, params, query):
    conn = get_conn()
    row = conn.execute("SELECT * FROM institution WHERE id=?", (params["id"],)).fetchone()
    if not row:
        raise ApiError(404, "机构不存在")
    if body.get("name") and body["name"] != row["name"]:
        dup = conn.execute(
            "SELECT id FROM institution WHERE name=? AND id != ?",
            (body["name"], params["id"]),
        ).fetchone()
        if dup:
            raise ApiError(409, "机构名称重复")
    fields = ["name", "contact", "phone", "email", "address", "note"]
    data = {k: body[k] for k in fields if k in body}
    update_by_id(conn, "institution", params["id"], data)
    conn.commit()
    conn.close()
    return {"ok": True}


@route("DELETE", "/api/institutions/{id}")
def delete_institution(body, params, query):
    conn = get_conn()
    using = conn.execute(
        "SELECT loan_no FROM loan WHERE institution_id=? AND status != 'cancelled' LIMIT 1",
        (params["id"],),
    ).fetchone()
    if using:
        conn.close()
        raise ApiError(409, f"该机构存在有效借展单 {using['loan_no']}，无法删除")
    try:
        conn.execute("DELETE FROM institution WHERE id=?", (params["id"],))
        conn.commit()
    except Exception:
        conn.rollback()
        raise ApiError(409, "该机构已被历史借展单引用，无法删除")
    finally:
        conn.close()
    return {"ok": True}
