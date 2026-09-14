# -*- coding: utf-8 -*-
"""通用辅助：行转字典、插入/更新、日期校验、编号生成。"""
import datetime
import sqlite3

from web import ApiError


def row_to_dict(row):
    return dict(row) if row is not None else None


def rows_to_dicts(rows):
    return [dict(r) for r in rows]


DATE_RE = __import__("re").compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_date(value, field="日期"):
    if not value or not DATE_RE.match(str(value)):
        raise ApiError(400, f"{field}格式应为 YYYY-MM-DD")
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        raise ApiError(400, f"{field}不是有效日期")


def require(body, fields):
    """校验必填字段，返回 (values dict)。fields: [(key, label)]。"""
    out = {}
    for key, label in fields:
        val = body.get(key)
        if val is None or (isinstance(val, str) and not val.strip()):
            raise ApiError(400, f"{label}不能为空")
        out[key] = val.strip() if isinstance(val, str) else val
    return out


def insert(conn, table, data):
    cols = list(data.keys())
    placeholders = ",".join("?" for _ in cols)
    sql = f"INSERT INTO {table} ({','.join(cols)}) VALUES ({placeholders})"
    cur = conn.execute(sql, [data[c] for c in cols])
    return cur.lastrowid


def update_by_id(conn, table, row_id, data):
    if not data:
        return
    assigns = ",".join(f"{k}=?" for k in data)
    values = list(data.values()) + [row_id]
    conn.execute(f"UPDATE {table} SET {assigns} WHERE id=?", values)


def gen_loan_no(conn):
    year = datetime.date.today().year
    cur = conn.execute(
        "SELECT COUNT(*) AS c FROM loan WHERE loan_no LIKE ?", (f"LN-{year}-%",)
    )
    return f"LN-{year}-{cur.fetchone()['c'] + 1:04d}"


def conflict_check(conn, artwork_id, start, end, exclude_loan_id=None):
    """检查单件作品在 [start, end] 内是否与已有（非取消、非草稿）借展冲突。

    区间重叠判定：既有开始 <= 新结束 且 既有结束 >= 新开始。
    同一张借展单编辑时通过 exclude_loan_id 排除自身。
    返回冲突借展信息 dict 或 None。
    """
    sql = """
        SELECT l.id, l.loan_no, l.start_date, l.end_date, l.status,
               i.name AS institution_name
        FROM loan_artwork la
        JOIN loan l ON l.id = la.loan_id
        JOIN institution i ON i.id = l.institution_id
        WHERE la.artwork_id = ?
          AND l.status NOT IN ('cancelled')
          AND l.start_date <= ? AND l.end_date >= ?
    """
    params = [artwork_id, end.isoformat(), start.isoformat()]
    if exclude_loan_id:
        sql += " AND l.id != ?"
        params.append(exclude_loan_id)
    row = conn.execute(sql, params).fetchone()
    return row_to_dict(row)


def foreign_key_violation(exc):
    return isinstance(exc, sqlite3.IntegrityError)
