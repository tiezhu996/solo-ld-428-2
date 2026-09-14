# -*- coding: utf-8 -*-
"""艺术作品借展与运输交接系统 —— 启动入口（仅依赖 Python 3 标准库）。

运行：python3 app.py [--port 8000] [--host 127.0.0.1]
浏览器打开 http://127.0.0.1:8000
"""
import argparse
import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import get_conn, DB_PATH  # noqa: E402
from schema import init_db  # noqa: E402
from web import ROUTES, find_route, read_body, query_params, ApiError  # noqa: E402
from database.seed import seed_if_empty  # noqa: E402

# 导入路由模块以触发 @route 注册
from routes import artworks  # noqa: E402,F401
from routes import institutions  # noqa: E402,F401
from routes import loans  # noqa: E402,F401
from routes import insurance  # noqa: E402,F401
from routes import packing  # noqa: E402,F401
from routes import handovers  # noqa: E402,F401
from routes import return_check  # noqa: E402,F401
from routes import reminders  # noqa: E402,F401

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web")

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".json": "application/json; charset=utf-8",
}


class AppHandler(BaseHTTPRequestHandler):
    server_version = "LoanSystem/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    # ---- 静态文件 ----
    def _serve_static(self, rel_path):
        if rel_path in ("", "/"):
            rel_path = "/index.html"
        # 防目录穿越
        safe = os.path.normpath(os.path.join(FRONTEND_DIR, rel_path.lstrip("/")))
        if not safe.startswith(os.path.abspath(FRONTEND_DIR)):
            self._send_json(403, {"error": "forbidden"})
            return
        if os.path.isdir(safe) or not os.path.isfile(safe):
            # SPA 回退
            safe = os.path.join(FRONTEND_DIR, "index.html")
        ext = os.path.splitext(safe)[1]
        try:
            with open(safe, "rb") as f:
                data = f.read()
        except OSError:
            self._send_json(404, {"error": "not found"})
            return
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    # ---- JSON 响应 ----
    def _send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _handle_api(self, method):
        from urllib.parse import urlparse
        path = urlparse(self.path).path
        handler, path_params = find_route(method, path)
        if not handler:
            self._send_json(404, {"error": f"接口不存在: {method} {path}"})
            return
        try:
            body = read_body(self) if method in ("POST", "PUT", "PATCH", "DELETE") else {}
            q = query_params(self)
            result = handler(body, path_params, q)
            self._send_json(200, result if result is not None else {"ok": True})
        except ApiError as exc:
            payload = {"error": exc.message}
            if exc.details:
                payload.update(exc.details)
            self._send_json(exc.status, payload)
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            self._send_json(500, {"error": f"服务器内部错误: {exc}"})

    def do_GET(self):
        if self.path.split("?")[0].startswith("/api/"):
            self._handle_api("GET")
        else:
            self._serve_static(self.path.split("?")[0])

    def do_POST(self):
        self._handle_api("POST")

    def do_PUT(self):
        self._handle_api("PUT")

    def do_DELETE(self):
        self._handle_api("DELETE")


def main():
    parser = argparse.ArgumentParser(description="艺术作品借展与运输交接系统")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    init_db()
    conn = get_conn()
    seed_if_empty(conn)
    conn.close()

    httpd = ThreadingHTTPServer((args.host, args.port), AppHandler)
    print("=" * 60)
    print(" 艺术作品借展与运输交接系统 已启动")
    print(f" 访问地址: http://{args.host}:{args.port}")
    print(f" 数据库文件: {os.path.abspath(DB_PATH)}")
    print(" 按 Ctrl+C 停止")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止...")
        httpd.shutdown()


if __name__ == "__main__":
    main()
