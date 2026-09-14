# -*- coding: utf-8 -*-
"""装箱清单 API：包装箱 + 每件作品入箱登记。"""
from db import get_conn
from web import route, ApiError
from helpers import require, insert


def _loan_or_404(conn, loan_id):
    loan = conn.execute("SELECT * FROM loan WHERE id=?", (loan_id,)).fetchone()
    if not loan:
        raise ApiError(404, "借展单不存在")
    return loan


def _artwork_in_loan(conn, loan_id, artwork_id):
    row = conn.execute(
        "SELECT 1 FROM loan_artwork WHERE loan_id=? AND artwork_id=?",
        (loan_id, artwork_id),
    ).fetchone()
    if not row:
        raise ApiError(400, f"作品 id={artwork_id} 不在本借展单中")


@route("POST", "/api/loans/{id}/crates")
def add_crate(body, params, query):
    vals = require(body, [("crate_no", "箱号")])
    conn = get_conn()
    _loan_or_404(conn, params["id"])
    dup = conn.execute(
        "SELECT id FROM crate WHERE loan_id=? AND crate_no=?",
        (params["id"], vals["crate_no"]),
    ).fetchone()
    if dup:
        conn.close()
        raise ApiError(409, f"箱号 {vals['crate_no']} 已存在")
    try:
        weight = float(body.get("weight_kg") or 0)
    except (TypeError, ValueError):
        raise ApiError(400, "重量必须是数字")
    new_id = insert(conn, "crate", {
        "loan_id": int(params["id"]),
        "crate_no": vals["crate_no"],
        "crate_type": body.get("crate_type", ""),
        "weight_kg": weight,
        "note": body.get("note", ""),
    })
    conn.commit()
    conn.close()
    return {"id": new_id}


@route("PUT", "/api/crates/{cid}")
def update_crate(body, params, query):
    conn = get_conn()
    row = conn.execute("SELECT * FROM crate WHERE id=?", (params["cid"],)).fetchone()
    if not row:
        raise ApiError(404, "包装箱不存在")
    data = {}
    for f in ("crate_no", "crate_type", "note"):
        if f in body:
            data[f] = body[f]
    if "weight_kg" in body:
        try:
            data["weight_kg"] = float(body["weight_kg"] or 0)
        except (TypeError, ValueError):
            raise ApiError(400, "重量必须是数字")
    conn.execute(
        "UPDATE crate SET " + ",".join(f"{k}=?" for k in data) + " WHERE id=?",
        list(data.values()) + [params["cid"]],
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@route("DELETE", "/api/crates/{cid}")
def delete_crate(body, params, query):
    conn = get_conn()
    row = conn.execute("SELECT id FROM crate WHERE id=?", (params["cid"],)).fetchone()
    if not row:
        raise ApiError(404, "包装箱不存在")
    conn.execute("DELETE FROM crate WHERE id=?", (params["cid"],))
    conn.commit()
    conn.close()
    return {"ok": True}


@route("POST", "/api/crates/{cid}/items")
def add_packing_item(body, params, query):
    vals = require(body, [("artwork_id", "作品")])
    try:
        artwork_id = int(vals["artwork_id"])
    except (TypeError, ValueError):
        raise ApiError(400, "作品参数不合法")
    conn = get_conn()
    crate = conn.execute("SELECT * FROM crate WHERE id=?", (params["cid"],)).fetchone()
    if not crate:
        conn.close()
        raise ApiError(404, "包装箱不存在")
    _artwork_in_loan(conn, crate["loan_id"], artwork_id)

    # 一件作品在同一张借展单中只能装入一个箱子
    dup = conn.execute(
        """SELECT c.crate_no FROM packing_item pi
           JOIN crate c ON c.id = pi.crate_id
           WHERE c.loan_id=? AND pi.artwork_id=?""",
        (crate["loan_id"], artwork_id),
    ).fetchone()
    if dup:
        conn.close()
        raise ApiError(409, f"该作品已装入箱 {dup['crate_no']}，不能重复装箱")
    try:
        new_id = insert(conn, "packing_item", {
            "crate_id": int(params["cid"]),
            "artwork_id": artwork_id,
            "packing": body.get("packing", ""),
            "note": body.get("note", ""),
        })
        conn.commit()
    except Exception:
        conn.rollback()
        raise ApiError(409, "该作品已在此箱中")
    finally:
        conn.close()
    return {"id": new_id}


@route("DELETE", "/api/packing-items/{pid}")
def remove_packing_item(body, params, query):
    conn = get_conn()
    row = conn.execute("SELECT id FROM packing_item WHERE id=?", (params["pid"],)).fetchone()
    if not row:
        raise ApiError(404, "装箱记录不存在")
    conn.execute("DELETE FROM packing_item WHERE id=?", (params["pid"],))
    conn.commit()
    conn.close()
    return {"ok": True}
