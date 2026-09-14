# -*- coding: utf-8 -*-
"""演示数据：首次启动且库为空时自动灌入。数据相对“今天”生成，保证逾期/临近到期始终可见。"""
import datetime


def seed_if_empty(conn):
    count = conn.execute("SELECT COUNT(*) AS c FROM artwork").fetchone()["c"]
    if count:
        return
    now = datetime.datetime.now().isoformat(timespec="seconds")
    today = datetime.date.today()
    d = lambda offset: (today + datetime.timedelta(days=offset)).isoformat()

    def ins(table, data):
        cols = list(data.keys())
        sql = f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})"
        cur = conn.execute(sql, [data[c] for c in cols])
        return cur.lastrowid

    # ---------------- 机构 ----------------
    i1 = ins("institution", {"name": "上海当代艺术博物馆", "contact": "周岚",
        "phone": "021-33001234", "email": "loan@powerstation.org.cn",
        "address": "上海市黄浦区花园港路200号", "note": "长期合作机构", "created_at": now})
    i2 = ins("institution", {"name": "深圳何香凝美术馆", "contact": "林哲",
        "phone": "0755-26602020", "email": "collection@hxnamo.org",
        "address": "深圳市南山区华侨城", "note": "", "created_at": now})
    i3 = ins("institution", {"name": "东京森美术馆", "contact": "Yuki Tanaka",
        "phone": "+81-3-6406-6652", "email": "loan@mori.art.museum",
        "address": "106-6108 东京都港区六本木6-10-1", "note": "出境展，需提前60天报关", "created_at": now})

    # ---------------- 藏品 ----------------
    artworks = [
        ("Y2018.011", "秋山夕照", "林风眠", "1960", "彩墨纸本", "68×68 cm", "A库-01架", "纸面右下角有轻微旧斑"),
        ("Y2019.004", "静物与青瓷", "常玉", "1930", "布面油画", "73×92 cm", "A库-02架", "画框背面有修复痕迹"),
        ("Y2021.077", "都市夜归人", "张晓刚", "2005", "布面油画", "120×150 cm", "B库-03区", ""),
        ("Y2022.019", "山水实验 No.7", "徐冰", "2018", "水墨综合材料", "97×180 cm", "B库-01区", "装裱玻璃有1cm划痕(已知)"),
        ("D1995.102", "飞天浮雕残件", "佚名（唐）", "唐代", "石刻", "45×30×18 cm 重22kg", "C库-恒温柜", "表面风化，禁止触碰"),
        ("Y2017.053", "粉色房间", "刘野", "2010", "丙烯布面", "60×50 cm", "A库-04架", ""),
        ("P2008.031", "码头工人", "吴印咸", "1948", "银盐摄影", "40×50 cm", "D库-摄影柜", "照片边缘有银镜现象"),
        ("Y2020.064", "青铜时代变体", "隋建国", "2016", "青铜雕塑", "110×60×60 cm 重85kg", "雕塑厅-地台2", "基座有一处磕碰补色"),
    ]
    art_ids = []
    for acc, title, artist, year, medium, dims, loc, cond in artworks:
        art_ids.append(ins("artwork", {
            "accession_no": acc, "title": title, "artist": artist, "year": year,
            "medium": medium, "dimensions": dims, "location": loc,
            "condition_note": cond, "created_at": now,
        }))
    a0, a1, a2, a3, a4, a5, a6, a7 = art_ids

    # ---------------- 借展单 1：待出库（5天后开始，可用于冲突测试） ----------------
    l1 = ins("loan", {"loan_no": f"LN-{today.year}-0001", "institution_id": i1,
        "start_date": d(5), "end_date": d(45),
        "venue": "3楼 展厅B", "purpose": "“现代主义的余响”常设展",
        "status": "pending", "notes": "恒温恒湿，照度≤150lux", "created_at": now})
    conn.executemany("INSERT INTO loan_artwork (loan_id,artwork_id) VALUES (?,?)",
                     [(l1, a0), (l1, a1)])
    ins("insurance_policy", {"loan_id": l1, "policy_no": "PICC-2026-AX-77102",
        "insurer": "中国人民财产保险股份有限公司", "coverage_amount": 8500000,
        "currency": "CNY", "start_date": d(3), "end_date": d(48), "status": "active"})
    c1 = ins("crate", {"loan_id": l1, "crate_no": "CR-01", "crate_type": "恒温木箱",
        "weight_kg": 62, "note": ""})
    conn.execute("INSERT INTO packing_item (crate_id,artwork_id,packing,note) VALUES (?,?,?,?)",
                 (c1, a0, "无酸纸+Tyvek+泡沫卡槽", ""))
    c2 = ins("crate", {"loan_id": l1, "crate_no": "CR-02", "crate_type": "飞行箱",
        "weight_kg": 78, "note": ""})
    conn.execute("INSERT INTO packing_item (crate_id,artwork_id,packing,note) VALUES (?,?,?,?)",
                 (c2, a1, "画框护角+珍珠棉", ""))

    # ---------------- 借展单 2：借展中（到馆交接已完成，3天后到期） ----------------
    l2 = ins("loan", {"loan_no": f"LN-{today.year}-0002", "institution_id": i2,
        "start_date": d(-28), "end_date": d(3),
        "venue": "2号厅", "purpose": "“图像与记忆”摄影专题展",
        "status": "active", "notes": "", "created_at": now})
    conn.executemany("INSERT INTO loan_artwork (loan_id,artwork_id) VALUES (?,?)",
                     [(l2, a6), (l2, a5)])
    ins("insurance_policy", {"loan_id": l2, "policy_no": "PINGAN-PA-550218",
        "insurer": "中国平安财产保险", "coverage_amount": 3200000,
        "currency": "CNY", "start_date": d(-31), "end_date": d(5), "status": "active"})
    c3 = ins("crate", {"loan_id": l2, "crate_no": "CR-01", "crate_type": "画筒+平板箱",
        "weight_kg": 21, "note": "摄影作品需防震"})
    conn.executemany("INSERT INTO packing_item (crate_id,artwork_id,packing,note) VALUES (?,?,?,?)",
                     [(c3, a6, "无酸相纸袋", ""), (c3, a5, "护角+平板间隔", "")])
    h1 = ins("handover", {"loan_id": l2, "type": "outbound", "handover_date": d(-30),
        "from_party": "本馆藏品部", "to_party": "顺丰特运", "shipper": "顺丰特运（艺术品）",
        "receiver": "陈牧（押运）", "note": "车况正常，厢内温度21℃", "created_at": now})
    conn.executemany("INSERT INTO handover_item (handover_id,artwork_id,condition_status,condition_note) VALUES (?,?,?,?)",
                     [(h1, a6, "good", "出库核验与档案照片一致"),
                      (h1, a5, "good", "")])
    h2 = ins("handover", {"loan_id": l2, "type": "arrived", "handover_date": d(-29),
        "from_party": "顺丰特运", "to_party": "何香凝美术馆", "shipper": "顺丰特运（艺术品）",
        "receiver": "林哲", "note": "当日开箱", "created_at": now})
    conn.executemany("INSERT INTO handover_item (handover_id,artwork_id,condition_status,condition_note) VALUES (?,?,?,?)",
                     [(h2, a6, "good", "到馆状态良好"),
                      (h2, a5, "good", "")])

    # ---------------- 借展单 3：逾期未还（在展超期12天） ----------------
    l3 = ins("loan", {"loan_no": f"LN-{today.year}-0003", "institution_id": i3,
        "start_date": d(-75), "end_date": d(-12),
        "venue": "52F 主展厅", "purpose": "“Material as Language”群展",
        "status": "active", "notes": "展览延期谈判中，对方已口头确认还回", "created_at": now})
    conn.executemany("INSERT INTO loan_artwork (loan_id,artwork_id) VALUES (?,?)",
                     [(l3, a3), (l3, a4)])
    ins("insurance_policy", {"loan_id": l3, "policy_no": "TOKIO-NE-882310",
        "insurer": "Tokio Marine & Nichido", "coverage_amount": 120000000,
        "currency": "JPY", "start_date": d(-80), "end_date": d(-9), "status": "active"})
    c4 = ins("crate", {"loan_id": l3, "crate_no": "CR-01", "crate_type": "大型海运木箱",
        "weight_kg": 310, "note": "石材与长卷混装需做隔断"})
    conn.executemany("INSERT INTO packing_item (crate_id,artwork_id,packing,note) VALUES (?,?,?,?)",
                     [(c4, a3, "卷轴悬挂包装", ""),
                      (c4, a4, "定制EVA内衬+木撑", "重心标记向上")])
    h3 = ins("handover", {"loan_id": l3, "type": "outbound", "handover_date": d(-79),
        "from_party": "本馆藏品部", "to_party": "近铁物流", "shipper": "近铁物流 KWE",
        "receiver": "王竞", "note": "", "created_at": now})
    conn.executemany("INSERT INTO handover_item (handover_id,artwork_id,condition_status,condition_note) VALUES (?,?,?,?)",
                     [(h3, a3, "good", ""), (h3, a4, "good", "")])
    h4 = ins("handover", {"loan_id": l3, "type": "arrived", "handover_date": d(-76),
        "from_party": "近铁物流", "to_party": "森美术馆", "shipper": "近铁物流 KWE",
        "receiver": "Yuki Tanaka", "note": "开箱发现包装受潮", "created_at": now})
    conn.executemany("INSERT INTO handover_item (handover_id,artwork_id,condition_status,condition_note) VALUES (?,?,?,?)",
                     [(h4, a3, "good", "状态稳定"),
                      (h4, a4, "damaged", "外箱底部水渍约8cm，石件本体未见损伤，已拍照存证")])

    # ---------------- 借展单 4：已归还（含完整归还检查，一件损伤） ----------------
    l4 = ins("loan", {"loan_no": f"LN-{today.year}-0004", "institution_id": i1,
        "start_date": d(-120), "end_date": d(-60),
        "venue": "1楼 大堂", "purpose": "“雕塑与时间”特展",
        "status": "returned", "returned_at": d(-59), "notes": "", "created_at": now})
    conn.executemany("INSERT INTO loan_artwork (loan_id,artwork_id) VALUES (?,?)",
                     [(l4, a7), (l4, a2)])
    ins("insurance_policy", {"loan_id": l4, "policy_no": "PICC-2025-AX-60917",
        "insurer": "中国人民财产保险股份有限公司", "coverage_amount": 15000000,
        "currency": "CNY", "start_date": d(-123), "end_date": d(-57), "status": "expired"})
    c5 = ins("crate", {"loan_id": l4, "crate_no": "CR-01", "crate_type": "雕塑定制箱",
        "weight_kg": 190, "note": ""})
    conn.execute("INSERT INTO packing_item (crate_id,artwork_id,packing,note) VALUES (?,?,?,?)",
                 (c5, a7, "泡沫+木螺栓固定", ""))
    c6 = ins("crate", {"loan_id": l4, "crate_no": "CR-02", "crate_type": "恒温木箱",
        "weight_kg": 88, "note": ""})
    conn.execute("INSERT INTO packing_item (crate_id,artwork_id,packing,note) VALUES (?,?,?,?)",
                 (c6, a2, "画框护角+防潮纸", ""))
    for htype, hdate, frm, to, recv, note, item_cond in [
        ("outbound", d(-122), "本馆藏品部", "佳速物流", "许峰", "吊装作业",
         [(a7, "good", ""), (a2, "good", "")]),
        ("arrived", d(-121), "佳速物流", "上海当代艺术博物馆", "周岚", "",
         [(a7, "good", ""), (a2, "good", "")]),
        ("return_outbound", d(-60), "上海当代艺术博物馆", "佳速物流", "周岚", "撤展",
         [(a7, "good", "基座未见新增磕碰"), (a2, "damaged", "画框左下角运输压痕约3cm")]),
        ("return_inbound", d(-59), "佳速物流", "本馆藏品部", "高文（修复师）", "回库开箱",
         [(a7, "good", ""), (a2, "damaged", "画框损伤确认，画作本体完好")]),
    ]:
        hid = ins("handover", {"loan_id": l4, "type": htype, "handover_date": hdate,
            "from_party": frm, "to_party": to, "shipper": "佳速物流",
            "receiver": recv, "note": note, "created_at": now})
        conn.executemany(
            "INSERT INTO handover_item (handover_id,artwork_id,condition_status,condition_note) VALUES (?,?,?,?)",
            [(hid, aid, cond, cnote) for aid, cond, cnote in item_cond])
    rc = ins("return_check", {"loan_id": l4, "check_date": d(-59),
        "inspector": "高文", "location": "本馆 C库 修复室",
        "summary": "画作本体均完好；Y2021.077 外框损伤需修复后入库，已开工单。",
        "finalized": 1})
    conn.executemany(
        "INSERT INTO return_check_item (check_id,artwork_id,condition_status,condition_note,action) VALUES (?,?,?,?,?)",
        [(rc, a7, "good", "与出库状态一致", "正常归位 雕塑厅-地台2"),
         (rc, a2, "damaged", "原框左下角3cm压痕，布面无松动、无龟裂", "转修复室重裱外框，工单 RX-2026-031")])

    conn.commit()
    print(f"[seed] 已写入演示数据：{len(artworks)} 件作品，3 家机构，4 张借展单")
