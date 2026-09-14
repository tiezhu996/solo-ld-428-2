# -*- coding: utf-8 -*-
"""借展单回归测试。

覆盖五类边界，全部通过真实 HTTP 接口验证（非内部函数直调）：
  A. 已归还（returned）历史借展不阻止同一作品再次出借
  B. 与未结束借展（pending/outgoing/active，含逾期 active）时段重叠一律 409 拒绝
  C. 创建/编辑时重复作品编号 -> 400 明确提示，且库中数据保持不变（不产生 5xx）
  D. 取消待出库借展单后档期释放；非待出库状态不可取消
  E. 出库 -> 到馆 -> 归还逐件核对 -> 结项 的完整状态流转，以及非法跳序/重复登记拦截

运行方式（无需安装任何依赖，Python 3.8+）：
    python3 loan-system/tests/test_loan_regression.py
    python3 test_loan_regression.py            # 在 tests/ 目录下亦可
    python3 test_loan_regression.py -v         # 输出每条用例明细

实现：
  * 每个测试进程在临时目录中启动真实服务（server/app.py，随机空闲端口、
    独立 SQLite 文件），seed 数据相对“今天”生成，跑完即销毁，不污染本机库。
  * 退出码：全部通过 0，存在失败 1（可接入 CI）。
"""
import argparse
import datetime
import http.client
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER_APP = os.path.join(HERE, "..", "server", "app.py")

# ---- seed 数据中的稳定主键（首次启动自动灌入，见 database/seed.py）----
ART = {
    "qiushan": 1,    # 秋山夕照 —— LN-0001 pending (+5 ~ +45)
    "jingwu": 2,     # 静物与青瓷 —— LN-0001 pending
    "yeshi": 3,      # 都市夜归人 —— LN-0004 returned (-120 ~ -60)
    "shanshui": 4,   # 山水实验 —— LN-0003 active 逾期 (-75 ~ -12)
    "feitian": 5,    # 飞天浮雕 —— LN-0003 active 逾期
    "fense": 6,      # 粉色房间 —— LN-0002 active (-28 ~ +3)
    "matou": 7,      # 码头工人 —— LN-0002 active
    "qingtong": 8,   # 青铜时代变体 —— LN-0004 returned
}
INST_PSA, INST_HXN, INST_MORI = 1, 2, 3


# ---------------------------------------------------------------------------
# 极简测试框架
# ---------------------------------------------------------------------------
class CheckFailed(Exception):
    pass


class Runner:
    def __init__(self, verbose=False):
        self.verbose = verbose
        self.groups = []          # [(group, [(name, ok, detail)])]
        self._cur_group = None

    def group(self, title):
        self._cur_group = (title, [])
        self.groups.append(self._cur_group)

    def check(self, name, fn):
        try:
            detail = fn() or ""
            self._cur_group[1].append((name, True, str(detail)))
            if self.verbose:
                print(f"  PASS  {name}")
        except CheckFailed as exc:
            self._cur_group[1].append((name, False, str(exc)))
            print(f"  FAIL  {name}\n        {exc}")
        except Exception as exc:  # noqa: BLE001
            self._cur_group[1].append((name, False, f"异常: {exc!r}"))
            print(f"  ERROR {name}\n        {exc!r}")

    @property
    def failures(self):
        return [c for _, cases in self.groups for c in cases if not c[1]]

    def summary(self):
        total = sum(len(cs) for _, cs in self.groups)
        print("\n" + "=" * 72)
        for title, cases in self.groups:
            n_fail = sum(1 for _, ok, _ in cases if not ok)
            mark = "✓" if n_fail == 0 else f"✗ {n_fail} 失败"
            print(f"  [{mark}] {title}（{len(cases) - n_fail}/{len(cases)}）")
        print("-" * 72)
        print(f"  合计 {total} 条，失败 {len(self.failures)} 条")
        print("=" * 72)
        return len(self.failures) == 0


def expect(cond, message):
    if not cond:
        raise CheckFailed(message)


# ---------------------------------------------------------------------------
# 临时真实服务
# ---------------------------------------------------------------------------
class TestServer:
    def __init__(self):
        self.tmpdir = tempfile.mkdtemp(prefix="loan-regtest-")
        self.port = self._free_port()
        self.log = os.path.join(self.tmpdir, "server.log")
        self.proc = None

    @staticmethod
    def _free_port():
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]

    def start(self):
        logf = open(self.log, "wb")
        self.proc = subprocess.Popen(
            [sys.executable, os.path.abspath(SERVER_APP),
             "--host", "127.0.0.1", "--port", str(self.port)],
            cwd=self.tmpdir, stdout=logf, stderr=subprocess.STDOUT,
        )
        # 等待服务就绪（DB 初始化 + seed 通常 < 1 秒）
        deadline = time.time() + 15
        last_err = ""
        while time.time() < deadline:
            if self.proc.poll() is not None:
                raise RuntimeError("服务进程提前退出，日志:\n" + self._tail_log())
            try:
                status, _ = self.request("GET", "/api/stats")
                if status == 200:
                    return
            except Exception as exc:  # noqa: BLE001
                last_err = str(exc)
            time.sleep(0.2)
        raise RuntimeError(f"服务未在 15 秒内就绪: {last_err}\n{self._tail_log()}")

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _tail_log(self):
        try:
            with open(self.log, "rb") as f:
                return f.read().decode("utf-8", "replace")[-2000:]
        except OSError:
            return "(无日志)"

    def url(self, path):
        return f"http://127.0.0.1:{self.port}{path}"

    def request(self, method, path, body=None):
        data = None
        headers = {}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(self.url(path), data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read()
                return resp.status, json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            return exc.code, json.loads(raw) if raw else {}
        except http.client.HTTPException as exc:
            raise AssertionError(f"HTTP 层错误（疑似服务端 500/连接中断）: {exc}")


# ---------------------------------------------------------------------------
# 测试
# ---------------------------------------------------------------------------
def run_tests(srv, R):
    today = datetime.date.today()
    year = today.year
    d = lambda off: (today + datetime.timedelta(days=off)).isoformat()  # noqa: E731

    def loan_count():
        _, payload = srv.request("GET", "/api/loans")
        return len(payload["items"])

    def loan_status(lid):
        _, detail = srv.request("GET", f"/api/loans/{lid}")
        return detail["status"], detail

    # =============================================================== A.
    R.group("A. 已归还历史借展不阻止同一作品再出借")

    def a1():
        # 作品8（青铜）在已归还的 LN-0004（-120~-60）中；在同一历史窗口再借应成功
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_HXN, "start_date": d(-100), "end_date": d(-70),
            "artwork_ids": [ART["qingtong"]]})
        expect(status == 200, f"期望 200，实际 {status}: {payload}")
        expect(isinstance(payload.get("id"), int), "未返回新借展单 id")
    R.check("A1 与 returned 历史借展窗口重叠时创建成功", a1)

    def a2():
        # 作品3 同为历史借展归还作品；完全相同的历史窗口 + dry_run 也应通过
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_PSA, "start_date": d(-120), "end_date": d(-60),
            "artwork_ids": [ART["yeshi"]], "dry_run": True})
        expect(status == 200 and payload.get("valid") is True,
               f"期望预检通过，实际 {status}: {payload}")
    R.check("A2 dry_run 在历史窗口（含首尾相同）预检通过", a2)

    def a3():
        # dry_run 不得写库
        before = loan_count()
        srv.request("POST", "/api/loans", {
            "institution_id": INST_PSA, "start_date": d(150), "end_date": d(160),
            "artwork_ids": [ART["yeshi"]], "dry_run": True})
        after = loan_count()
        expect(before == after, f"dry_run 产生了数据变化：{before} -> {after}")
    R.check("A3 dry_run 预检不落库", a3)

    # =============================================================== B.
    R.group("B. 与未结束借展时段重叠必须 409 拒绝并返回冲突明细")

    def conflict_case(name, artwork, s_off, e_off, expect_loan_suffix):
        def case():
            status, payload = srv.request("POST", "/api/loans", {
                "institution_id": INST_HXN, "start_date": d(s_off), "end_date": d(e_off),
                "artwork_ids": [artwork]})
            expect(status == 409, f"期望 409，实际 {status}: {payload}")
            conflicts = payload.get("conflicts", [])
            expect(len(conflicts) == 1, f"应返回 1 条冲突明细，实际 {conflicts}")
            expect(conflicts[0]["loan_no"] == f"LN-{year}-{expect_loan_suffix}",
                   f"冲突单号不符：{conflicts[0].get('loan_no')}")
            expect(payload.get("error", "").find("冲突") >= 0, "错误信息未说明冲突原因")
        R.check(name, case)

    conflict_case("B1 与 pending 待出库借展重叠被拒（作品秋山 +10~+20 vs LN-0001 +5~+45）",
                  ART["qiushan"], 10, 20, "0001")
    conflict_case("B2 与 active 借展中借展重叠被拒（作品码头 -5~+2 vs LN-0002 -28~+3）",
                  ART["matou"], -5, 2, "0002")
    conflict_case("B3 与逾期未还借展重叠被拒（作品飞天 -20~-10 vs LN-0003 -75~-12）",
                  ART["feitian"], -20, -10, "0003")

    def b4():
        # 首尾相接（不重叠）：新借 +46..+50，前借到 +45
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_HXN, "start_date": d(46), "end_date": d(50),
            "artwork_ids": [ART["qiushan"]], "dry_run": True})
        expect(status == 200 and payload.get("valid") is True,
               f"档期首尾相接应可通过：{status} {payload}")
    R.check("B4 区间首尾相接（+46 起）不算重叠", b4)

    def b5():
        # 另一侧相接：新借 +1..+4，前借 +5 开始
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_HXN, "start_date": d(1), "end_date": d(4),
            "artwork_ids": [ART["qiushan"]], "dry_run": True})
        expect(status == 200 and payload.get("valid") is True,
               f"新借结束早于前借开始应可通过：{status} {payload}")
    R.check("B5 新借结束于前借开始前一天（+4 vs +5）不算重叠", b5)

    def b6():
        # 多作品混合：一件冲突即整单拒绝
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_HXN, "start_date": d(10), "end_date": d(12),
            "artwork_ids": [ART["qingtong"], ART["qiushan"]]})
        expect(status == 409, f"期望 409，实际 {status}")
        titles = [c["artwork_title"] for c in payload.get("conflicts", [])]
        expect(any("秋山" in t for t in titles), f"应指出冲突作品为秋山夕照：{titles}")
    R.check("B6 多件作品中一件冲突即整单阻止并标明冲突件", b6)

    def b7():
        before = loan_count()
        srv.request("POST", "/api/loans", {
            "institution_id": INST_HXN, "start_date": d(10), "end_date": d(20),
            "artwork_ids": [ART["qiushan"]]})
        expect(loan_count() == before, "冲突被拒后借展单数量发生变化（产生了脏数据）")
    R.check("B7 冲突拒绝不写入任何借展单", b7)

    # =============================================================== C.
    R.group("C. 创建/编辑重复作品编号必须 400 且数据不变")

    def c1():
        before = loan_count()
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_HXN, "start_date": d(300), "end_date": d(310),
            "artwork_ids": [ART["qingtong"], ART["qingtong"]]})
        after = loan_count()
        expect(status == 400, f"重复编号应返回 400，实际 {status}（500 即为缺陷）: {payload}")
        expect(str(ART["qingtong"]) in payload.get("error", ""),
               f"提示应明确指出重复项 #{ART['qingtong']}：{payload.get('error')}")
        expect("重复" in payload.get("error", ""), f"提示应说明“重复”：{payload.get('error')}")
        expect(before == after, f"拒绝后借展单数量变化：{before} -> {after}")
    R.check("C1 POST 创建重复编号 [8,8] -> 400 且不写库", c1)

    def c2():
        before = loan_count()
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_HXN, "start_date": d(300), "end_date": d(310),
            "artwork_ids": [ART["feitian"], ART["yeshi"], ART["feitian"]]})
        after = loan_count()
        expect(status == 400, f"期望 400，实际 {status}: {payload}")
        expect(f"#{ART['feitian']}" in payload.get("error", ""),
               f"应指出重复的 #5：{payload.get('error')}")
        expect(before == after, "被拒后借展单数量变化")
    R.check("C2 POST 混合列表 [5,3,5] -> 400 指出 #5 且不写库", c2)

    def c3():
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_HXN, "start_date": d(300), "end_date": d(310),
            "artwork_ids": "not-a-list"})
        expect(status == 400, f"非法类型应 400，实际 {status}: {payload}")
    R.check("C3 artwork_ids 非数组 -> 400（不出现 5xx）", c3)

    def c4():
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_HXN, "start_date": d(300), "end_date": d(310),
            "artwork_ids": []})
        expect(status == 400 and "至少" in payload.get("error", ""),
               f"空作品列表应 400 提示至少一件：{status} {payload}")
    R.check("C4 空作品列表 -> 400", c4)

    def c5():
        # 先建一张合法借展单（作品5，未来窗口不与任何在途借展冲突）
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_HXN, "start_date": d(300), "end_date": d(310),
            "artwork_ids": [ART["feitian"]]})
        expect(status == 200, f"前置借展单创建失败：{status} {payload}")
        lid = payload["id"]
        before_ids = None
        _, detail_before = srv.request("GET", f"/api/loans/{lid}")
        before_ids = [a["id"] for a in detail_before["artworks"]]
        before_status = detail_before["status"]

        # PUT 重复编号
        status, payload = srv.request("PUT", f"/api/loans/{lid}",
                                      {"artwork_ids": [ART["feitian"], ART["feitian"]]})
        expect(status == 400, f"PUT 重复编号应 400，实际 {status}: {payload}")
        expect(f"#{ART['feitian']}" in payload.get("error", ""),
               f"提示应指出重复项：{payload.get('error')}")

        _, detail_after = srv.request("GET", f"/api/loans/{lid}")
        after_ids = [a["id"] for a in detail_after["artworks"]]
        expect(before_ids == after_ids == [ART["feitian"]],
               f"被拒后关联作品被改动：{before_ids} -> {after_ids}")
        expect(detail_after["status"] == before_status == "pending",
               f"借展单状态被意外改动：{before_status} -> {detail_after['status']}")
    R.check("C5 PUT 编辑重复编号 -> 400，原关联作品与状态保持不变", c5)

    def c6():
        # 复用 C5 借展单：合法的去重编辑仍应可用（证明只拦重复、不误伤）
        _, loans = srv.request("GET", "/api/loans?status=pending")
        lid = None
        for item in loans["items"]:
            _, detail = srv.request("GET", f"/api/loans/{item['id']}")
            if [a["id"] for a in detail["artworks"]] == [ART["feitian"]] \
                    and detail["start_date"] == d(300):
                lid = item["id"]
                break
        expect(lid is not None, "未找到 C5 创建的借展单")
        status, payload = srv.request("PUT", f"/api/loans/{lid}",
                                      {"artwork_ids": [ART["feitian"], ART["yeshi"]]})
        expect(status == 200, f"合法编辑应成功：{status} {payload}")
        _, detail = srv.request("GET", f"/api/loans/{lid}")
        expect(sorted(a["id"] for a in detail["artworks"]) == [ART["yeshi"], ART["feitian"]],
               f"合法编辑未生效：{[a['id'] for a in detail['artworks']]}")
    R.check("C6 不含重复的正常 PUT 编辑仍然生效", c6)

    # =============================================================== D.
    R.group("D. 取消借展单释放档期")

    def d_all():
        # D1: 作品1 在 +60..+70 新建借展 X（与 LN-0001 +5..+45 不冲突）
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_MORI, "start_date": d(60), "end_date": d(70),
            "artwork_ids": [ART["qiushan"]]})
        expect(status == 200, f"借展 X 创建失败：{status} {payload}")
        x_id = payload["id"]

        # D2: 同作品 +65..+66 必须被 X 冲突拒绝
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_PSA, "start_date": d(65), "end_date": d(66),
            "artwork_ids": [ART["qiushan"]]})
        expect(status == 409, f"期望被借展 X 冲突拒绝：{status} {payload}")
        expect(payload["conflicts"][0]["id"] == x_id,
               f"冲突对象应为新借展 X：{payload['conflicts']}")

        # D3: 非 pending 借展不能取消（LN-0002 为 active）
        _, loans_payload = srv.request("GET", "/api/loans")
        active_id = next(i["id"] for i in loans_payload["items"]
                         if i["loan_no"] == f"LN-{year}-0002")
        status, payload = srv.request("POST", f"/api/loans/{active_id}/cancel", {})
        expect(status == 409, f"active 借展应不可取消：{status} {payload}")

        # D4: 取消 X
        status, payload = srv.request("POST", f"/api/loans/{x_id}/cancel", {})
        expect(status == 200, f"取消 X 失败：{status} {payload}")
        _, x_detail = srv.request("GET", f"/api/loans/{x_id}")
        expect(x_detail["status"] == "cancelled",
               f"X 状态应为 cancelled：{x_detail['status']}")

        # D5: 取消后同窗口 +65..+66 立即可以再借
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_PSA, "start_date": d(65), "end_date": d(66),
            "artwork_ids": [ART["qiushan"]]})
        expect(status == 200, f"取消后档期应释放、可再借：{status} {payload}")
    R.check("D1 占用 -> 重叠被拒 -> 取消 -> 档期释放可再借；active 单不可取消", d_all)

    # =============================================================== E.
    R.group("E. 出库 -> 到馆 -> 归还核对 -> 结项 状态流转")

    def e_all():
        # E0: 专用借展（作品3，已从历史借展归还，未来窗口 +500..+510）
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_PSA, "start_date": d(500), "end_date": d(510),
            "purpose": "回归-全流程", "artwork_ids": [ART["yeshi"]]})
        expect(status == 200, f"E0 创建失败：{status} {payload}")
        lid = payload["id"]
        st, _ = loan_status(lid)
        expect(st == "pending", f"新建后应为 pending，实际 {st}")

        def handover(htype, hdate, items, expect_status=200):
            return srv.request("POST", f"/api/loans/{lid}/handovers", {
                "type": htype, "handover_date": hdate,
                "from_party": "本馆藏品部", "to_party": "合作机构",
                "shipper": "测试物流", "receiver": "测试签收人", "items": items})

        good3 = [{"artwork_id": ART["yeshi"], "condition_status": "good",
                  "condition_note": "状态与档案一致"}]

        # E1: 跳序 —— pending 状态直接到馆交接
        status, payload = handover("arrived", d(500), good3)
        expect(status == 409, f"E1 未出库先到馆应 409：{status} {payload}")

        # E2: 出库但清单为空
        status, payload = handover("outbound", d(500), [])
        expect(status == 400, f"E2 空交接清单应 400：{status} {payload}")

        # E3: 出库但登记了不属于本单的作品
        status, payload = handover("outbound", d(500), [
            {"artwork_id": ART["qiushan"], "condition_status": "good"}])
        expect(status == 400, f"E3 非本单作品应 400：{status} {payload}")

        # E4: 正常出库
        status, payload = handover("outbound", d(500), good3)
        expect(status == 200, f"E4 出库交接失败：{status} {payload}")
        st, detail = loan_status(lid)
        expect(st == "outgoing", f"出库后应为 outgoing，实际 {st}")

        # E5: 重复出库
        status, payload = handover("outbound", d(500), good3)
        expect(status == 409, f"E5 重复出库应 409：{status} {payload}")

        # E6: 到馆（登记损伤，验证状况如实落库）
        damaged3 = [{"artwork_id": ART["yeshi"], "condition_status": "damaged",
                     "condition_note": "画框左下角2cm压痕"}]
        status, payload = handover("arrived", d(501), damaged3)
        expect(status == 200, f"E6 到馆交接失败：{status} {payload}")
        st, detail = loan_status(lid)
        expect(st == "active", f"到馆后应为 active，实际 {st}")
        arrived = [h for h in detail["handovers"] if h["type"] == "arrived"][0]
        expect(arrived["items"][0]["condition_status"] == "damaged"
               and "压痕" in arrived["items"][0]["condition_note"],
               "到馆登记的损伤状况未如实保存")

        # E7: active 状态重复到馆
        status, payload = handover("arrived", d(501), damaged3)
        expect(status == 409, f"E7 重复到馆应 409：{status} {payload}")

        # E8: 未做任何核对直接结项
        status, payload = srv.request("POST", f"/api/loans/{lid}/return-check/finalize", {})
        expect(status == 400, f"E8 未核对结项应 400：{status} {payload}")

        # E9: 仅保存检查单头（无 items），结项仍应被拦
        status, payload = srv.request("PUT", f"/api/loans/{lid}/return-check", {
            "check_date": d(510), "inspector": "回归检查员", "location": "本馆修复室"})
        expect(status == 200, f"E9 保存检查单头失败：{status} {payload}")
        status, payload = srv.request("POST", f"/api/loans/{lid}/return-check/finalize", {})
        expect(status == 400, f"E9 未逐件核对仍不应结项：{status} {payload}")

        # E10: 逐件核对（损伤 + 处理意见），然后结项
        status, payload = srv.request("PUT", f"/api/loans/{lid}/return-check", {
            "items": [{"artwork_id": ART["yeshi"], "condition_status": "damaged",
                       "condition_note": "画框压痕确认，画作本体完好",
                       "action": "转修复室重裱外框"}]})
        expect(status == 200, f"E10 保存逐件核对失败：{status} {payload}")
        status, payload = srv.request("POST", f"/api/loans/{lid}/return-check/finalize", {})
        expect(status == 200, f"E10 结项失败：{status} {payload}")
        st, detail = loan_status(lid)
        expect(st == "returned", f"结项后应为 returned，实际 {st}")
        expect(detail["returned_at"] == d(510),
               f"归还日期应为检查日期 {d(510)}，实际 {detail['returned_at']}")
        rc = detail["return_check"]
        expect(rc["finalized"] == 1 and len(rc["items"]) == 1
               and rc["items"][0]["action"].find("修复") >= 0,
               "结项后的归还检查单内容不完整")

        # E11: 结项后记录锁定
        status, payload = srv.request("PUT", f"/api/loans/{lid}/return-check",
                                      {"summary": "试图改写"})
        expect(status == 409, f"E11 结项后应锁定（409）：{status} {payload}")

        # E12: 结项后不可再登记交接
        status, payload = handover("return_outbound", d(510), good3)
        expect(status == 409, f"E12 已结项单再交接应 409：{status} {payload}")

        # E13: 归还后同作品在同一展期可再次出借（与 A 组规则互相印证）
        status, payload = srv.request("POST", "/api/loans", {
            "institution_id": INST_MORI, "start_date": d(505), "end_date": d(508),
            "artwork_ids": [ART["yeshi"]], "dry_run": True})
        expect(status == 200 and payload.get("valid") is True,
               f"E13 归还后档期应释放：{status} {payload}")
    R.check("E1~E13 全流程：非法跳序/缺件/重复均拦截，正常推进并核对结项，结项后锁定", e_all)

    # =============================================================== F.
    R.group("F. 流转过程中提醒数据始终可用")

    def f1():
        status, payload = srv.request("GET", "/api/reminders")
        expect(status == 200, f"提醒接口异常：{status}")
        overdue_nos = [x["loan_no"] for x in payload["overdue_loans"]]
        expect(f"LN-{year}-0003" in overdue_nos,
               f"逾期借展 LN-{year}-0003 应在提醒中：{overdue_nos}")
        due_nos = [x["loan_no"] for x in payload["due_soon_loans"]]
        expect(f"LN-{year}-0002" in due_nos,
               f"临期借展 LN-{year}-0002 应在提醒中：{due_nos}")
        issues = payload["transit_issues"]
        expect(any(x["loan_no"] == f"LN-{year}-0003" for x in issues),
               "在途损伤（LN-0003 外箱水渍）应持续被跟踪")
    R.check("F1 逾期/临期/在途异常提醒在流转后仍正确", f1)


def main():
    parser = argparse.ArgumentParser(description="借展单回归测试")
    parser.add_argument("-v", "--verbose", action="store_true", help="输出每条用例")
    args = parser.parse_args()

    srv = TestServer()
    R = Runner(verbose=args.verbose)
    try:
        print(f"启动临时测试服务（临时目录 {srv.tmpdir}）...")
        srv.start()
        print(f"服务已就绪：127.0.0.1:{srv.port}（独立临时数据库，结束后自动销毁）\n")
        run_tests(srv, R)
    finally:
        srv.stop()

    ok = R.summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
