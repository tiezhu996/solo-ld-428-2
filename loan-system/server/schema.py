# -*- coding: utf-8 -*-
"""建表脚本。所有日期以 ISO(YYYY-MM-DD) 字符串存储。"""
from db import get_conn

SCHEMA = """
CREATE TABLE IF NOT EXISTS institution (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    contact     TEXT DEFAULT '',
    phone       TEXT DEFAULT '',
    email       TEXT DEFAULT '',
    address     TEXT DEFAULT '',
    note        TEXT DEFAULT '',
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artwork (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    accession_no TEXT NOT NULL UNIQUE,      -- 馆藏编号
    title       TEXT NOT NULL,
    artist      TEXT DEFAULT '',
    year        TEXT DEFAULT '',
    medium      TEXT DEFAULT '',            -- 媒介
    dimensions  TEXT DEFAULT '',            -- 尺寸，如 60×80 cm
    location    TEXT DEFAULT '',            -- 库位
    condition_note TEXT DEFAULT '',         -- 原始状况记录
    status      TEXT NOT NULL DEFAULT 'available',
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loan (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_no       TEXT NOT NULL UNIQUE,
    institution_id INTEGER NOT NULL REFERENCES institution(id),
    start_date    TEXT NOT NULL,           -- 借展开始
    end_date      TEXT NOT NULL,           -- 借展结束（应归还日）
    venue         TEXT DEFAULT '',         -- 展厅
    purpose       TEXT DEFAULT '',         -- 用途/展览名称
    status        TEXT NOT NULL DEFAULT 'pending',
    -- pending 待出库 / outgoing 已出库在途 / active 借展中 /
    -- returned 已归还 / overdue 逾期（动态，库里一般存 active，由计算标记）/ cancelled 已取消
    notes         TEXT DEFAULT '',
    returned_at   TEXT,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loan_artwork (
    loan_id    INTEGER NOT NULL REFERENCES loan(id) ON DELETE CASCADE,
    artwork_id INTEGER NOT NULL REFERENCES artwork(id),
    PRIMARY KEY (loan_id, artwork_id)
);

CREATE TABLE IF NOT EXISTS insurance_policy (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id          INTEGER NOT NULL UNIQUE REFERENCES loan(id) ON DELETE CASCADE,
    policy_no        TEXT NOT NULL,
    insurer          TEXT NOT NULL,            -- 承保公司
    coverage_amount  REAL NOT NULL DEFAULT 0,  -- 保额
    currency         TEXT NOT NULL DEFAULT 'CNY',
    start_date       TEXT NOT NULL,
    end_date         TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'active' -- active / expired / claimed
);

CREATE TABLE IF NOT EXISTS crate (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id   INTEGER NOT NULL REFERENCES loan(id) ON DELETE CASCADE,
    crate_no  TEXT NOT NULL,        -- 箱号，如 CR-01
    crate_type TEXT DEFAULT '',     -- 木箱/飞行箱/画筒
    weight_kg REAL DEFAULT 0,
    note      TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS packing_item (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    crate_id   INTEGER NOT NULL REFERENCES crate(id) ON DELETE CASCADE,
    artwork_id INTEGER NOT NULL REFERENCES artwork(id),
    packing    TEXT DEFAULT '',   -- 包装方式
    note       TEXT DEFAULT '',
    UNIQUE (crate_id, artwork_id)
);

CREATE TABLE IF NOT EXISTS handover (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id     INTEGER NOT NULL REFERENCES loan(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,  -- outbound 出库交接 / arrived 到馆交接
                 -- return_outbound 还回出库 / return_inbound 回库交接
    handover_date TEXT NOT NULL,
    from_party  TEXT DEFAULT '',
    to_party    TEXT DEFAULT '',
    shipper     TEXT DEFAULT '',      -- 承运方
    receiver    TEXT DEFAULT '',      -- 接收/签收人
    note        TEXT DEFAULT '',
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handover_item (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    handover_id INTEGER NOT NULL REFERENCES handover(id) ON DELETE CASCADE,
    artwork_id  INTEGER NOT NULL REFERENCES artwork(id),
    condition_status TEXT NOT NULL, -- good 完好 / damaged 损伤 / missing 缺失
    condition_note TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS return_check (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id      INTEGER NOT NULL UNIQUE REFERENCES loan(id) ON DELETE CASCADE,
    check_date   TEXT NOT NULL,
    inspector    TEXT DEFAULT '',     -- 检查人
    location     TEXT DEFAULT '',     -- 检查地点
    summary      TEXT DEFAULT '',     -- 总体结论
    finalized    INTEGER NOT NULL DEFAULT 0  -- 1 = 全部核对完成，借展结项
);

CREATE TABLE IF NOT EXISTS return_check_item (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id     INTEGER NOT NULL REFERENCES return_check(id) ON DELETE CASCADE,
    artwork_id   INTEGER NOT NULL REFERENCES artwork(id),
    condition_status TEXT NOT NULL,  -- good / damaged / missing
    condition_note TEXT DEFAULT '',
    action       TEXT DEFAULT '',    -- 处理意见
    UNIQUE (check_id, artwork_id)
);
"""


def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
