# -*- coding: utf-8 -*-
"""保单 API：一张借展单一份保单（墙到墙）。"""
from db import get_conn
from web import route, ApiError
from helpers import require, parse_date, insert, update_by_id


def _get_loan(conn, loan_id):
    loan = conn.execute("SELECT * FROM loan WHERE id=?", (loan_id,)).fetchone()
    if not loan:
        raise ApiError(404, "借展单不存在")
    return loan


@route("GET", "/api/loans/{id}/insurance")
def get_insurance(body, params, query):
    conn = get_conn()
    _get_loan(conn, params["id"])
    row = conn.execute(
        "SELECT * FROM insurance_policy WHERE loan_id=?", (params["id"],)
    ).fetchone()
    conn.close()
    if not row:
        raise ApiError(404, "该借展单尚未登记保单")
    return dict(row)


@route("PUT", "/api/loans/{id}/insurance")
def upsert_insurance(body, params, query):
    vals = require(body, [("policy_no", "保单号"), ("insurer", "承保公司")])
    start = parse_date(body.get("start_date"), "保险起期")
    end = parse_date(body.get("end_date"), "保险止期")
    if end < start:
        raise ApiError(400, "保险止期不能早于起期")
    try:
        amount = float(body.get("coverage_amount") or 0)
    except (TypeError, ValueError):
        raise ApiError(400, "保额必须是数字")
    if amount < 0:
        raise ApiError(400, "保额不能为负")

    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        loan = _get_loan(conn, params["id"])
        if loan["status"] == "cancelled":
            raise ApiError(409, "借展单已取消，不能登记保单")
        existing = conn.execute(
            "SELECT id FROM insurance_policy WHERE loan_id=?", (params["id"],)
        ).fetchone()
        data = {
            "policy_no": vals["policy_no"],
            "insurer": vals["insurer"],
            "coverage_amount": amount,
            "currency": body.get("currency") or "CNY",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "status": body.get("status") or "active",
        }
        if existing:
            update_by_id(conn, "insurance_policy", existing["id"], data)
        else:
            data["loan_id"] = int(params["id"])
            insert(conn, "insurance_policy", data)
        conn.commit()
    except ApiError:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"ok": True}
