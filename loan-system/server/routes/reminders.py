# -*- coding: utf-8 -*-
"""逾期/到期提醒与仪表盘统计。"""
import datetime

from db import get_conn
from web import route
from helpers import rows_to_dicts

OVERDUE_DAYS = 0        # 已过结束日期即逾期
DUE_SOON_DAYS = 7       # 7 天内到期
INSURANCE_SOON_DAYS = 14  # 保单 14 天内到期


def _derive_loans(rows, today):
    items = rows_to_dicts(rows)
    for item in items:
        end = datetime.date.fromisoformat(item["end_date"])
        item["days_overdue"] = (today - end).days
        item["days_remaining"] = (end - today).days
        if item["status"] in ("pending", "outgoing", "active") and end < today:
            item["derived_status"] = "overdue"
        else:
            item["derived_status"] = item["status"]
    return items


@route("GET", "/api/reminders")
def reminders(body, params, query):
    conn = get_conn()
    today = datetime.date.today()
    week_later = today + datetime.timedelta(days=DUE_SOON_DAYS)
    ins_later = today + datetime.timedelta(days=INSURANCE_SOON_DAYS)

    active_loans = conn.execute(
        """SELECT l.id, l.loan_no, l.end_date, l.status, l.purpose,
                  i.name AS institution_name
           FROM loan l JOIN institution i ON i.id=l.institution_id
           WHERE l.status IN ('pending','outgoing','active')"""
    ).fetchall()
    loans = _derive_loans(active_loans, today)

    overdue = [x for x in loans if x["derived_status"] == "overdue"]
    overdue.sort(key=lambda x: x["end_date"])
    due_soon = [
        x for x in loans
        if x["derived_status"] != "overdue" and x["days_remaining"] <= DUE_SOON_DAYS
    ]
    due_soon.sort(key=lambda x: x["end_date"])

    # 进行中借展对应的保单即将到期
    insurance_expiring = conn.execute(
        """SELECT p.id, p.policy_no, p.insurer, p.end_date, l.loan_no, l.id AS loan_id,
                  i.name AS institution_name
           FROM insurance_policy p
           JOIN loan l ON l.id=p.loan_id
           JOIN institution i ON i.id=l.institution_id
           WHERE p.status='active'
             AND l.status IN ('pending','outgoing','active')
             AND p.end_date <= ?
           ORDER BY p.end_date""",
        (ins_later.isoformat(),),
    ).fetchall()
    ins_items = rows_to_dicts(insurance_expiring)
    for x in ins_items:
        end = datetime.date.fromisoformat(x["end_date"])
        x["days_remaining"] = (end - today).days

    # 最近一次交接中出现损伤/缺失，且借展未结项
    issues = conn.execute(
        """SELECT hi.condition_status, hi.condition_note, h.type AS handover_type,
                  h.handover_date, l.loan_no, l.id AS loan_id,
                  a.accession_no, a.title
           FROM handover_item hi
           JOIN handover h ON h.id=hi.handover_id
           JOIN loan l ON l.id=h.loan_id
           JOIN artwork a ON a.id=hi.artwork_id
           WHERE hi.condition_status IN ('damaged','missing')
             AND l.status IN ('pending','outgoing','active')
           ORDER BY h.handover_date DESC, l.loan_no"""
    ).fetchall()

    # 归还检查中发现损伤/缺失（已结项的也提示，供后续处理追踪）
    return_issues = conn.execute(
        """SELECT rci.condition_status, rci.condition_note, rci.action,
                  l.loan_no, l.id AS loan_id, a.accession_no, a.title
           FROM return_check_item rci
           JOIN return_check rc ON rc.id=rci.check_id
           JOIN loan l ON l.id=rc.loan_id
           JOIN artwork a ON a.id=rci.artwork_id
           WHERE rci.condition_status IN ('damaged','missing')
           ORDER BY rc.check_date DESC"""
    ).fetchall()

    conn.close()
    return {
        "today": today.isoformat(),
        "overdue_loans": overdue,
        "due_soon_loans": due_soon,
        "insurance_expiring": ins_items,
        "transit_issues": rows_to_dicts(issues),
        "return_issues": rows_to_dicts(return_issues),
        "counts": {
            "overdue": len(overdue),
            "due_soon": len(due_soon),
            "insurance_expiring": len(ins_items),
            "transit_issues": len(issues),
            "return_issues": len(return_issues),
        },
    }


@route("GET", "/api/stats")
def stats(body, params, query):
    conn = get_conn()
    today = datetime.date.today().isoformat()

    def scalar(sql, args=()):
        return conn.execute(sql, args).fetchone()[0] or 0

    total_artworks = scalar("SELECT COUNT(*) FROM artwork")
    on_loan = scalar(
        """SELECT COUNT(DISTINCT la.artwork_id)
           FROM loan_artwork la JOIN loan l ON l.id=la.loan_id
           WHERE l.status IN ('outgoing','active')"""
    )
    reserved = scalar(
        """SELECT COUNT(*) FROM (
             SELECT la.artwork_id, MIN(l.start_date) AS s
             FROM loan_artwork la JOIN loan l ON l.id=la.loan_id
             WHERE l.status='pending'
               AND la.artwork_id NOT IN (
                 SELECT la2.artwork_id FROM loan_artwork la2
                 JOIN loan l2 ON l2.id=la2.loan_id
                 WHERE l2.status IN ('outgoing','active'))
             GROUP BY la.artwork_id)"""
    )
    total_institutions = scalar("SELECT COUNT(*) FROM institution")
    active_loans = scalar(
        "SELECT COUNT(*) FROM loan WHERE status IN ('pending','outgoing','active')"
    )
    overdue = scalar(
        """SELECT COUNT(*) FROM loan
           WHERE status IN ('pending','outgoing','active') AND end_date < ?""",
        (today,),
    )
    returned = scalar("SELECT COUNT(*) FROM loan WHERE status='returned'")
    insured_active = scalar(
        """SELECT COUNT(*) FROM insurance_policy p JOIN loan l ON l.id=p.loan_id
           WHERE p.status='active' AND l.status IN ('pending','outgoing','active')"""
    )

    recent = conn.execute(
        """SELECT h.handover_date, h.type, h.receiver, h.shipper, l.loan_no, l.id AS loan_id,
                  i.name AS institution_name
           FROM handover h JOIN loan l ON l.id=h.loan_id
           JOIN institution i ON i.id=l.institution_id
           ORDER BY h.handover_date DESC, h.id DESC LIMIT 8"""
    ).fetchall()
    conn.close()
    return {
        "artwork_total": total_artworks,
        "artwork_on_loan": on_loan,
        "artwork_reserved": reserved,
        "artwork_available": total_artworks - on_loan - reserved,
        "institution_total": total_institutions,
        "loan_active": active_loans,
        "loan_overdue": overdue,
        "loan_returned": returned,
        "insured_active": insured_active,
        "recent_handovers": rows_to_dicts(recent),
        "today": today,
    }
