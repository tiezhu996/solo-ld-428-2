# -*- coding: utf-8 -*-
"""数据库连接与行工厂。"""
import sqlite3

DB_PATH = "data/loans.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
