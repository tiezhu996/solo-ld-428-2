# -*- coding: utf-8 -*-
"""极简路由框架：基于 http.server，仅依赖 Python 标准库。

route 装饰器注册 (method, pattern) -> handler。
handler 接收 (body, path_params, query)，返回 dict（自动转 JSON）。
抛 ApiError 返回对应 HTTP 状态码。
"""
import json
import re
from urllib.parse import urlparse, parse_qs

ROUTES = []  # [(method, compiled_re, keys, handler)]


def route(method, pattern):
    method = method.upper()
    keys = re.findall(r"\{(\w+)\}", pattern)
    regex = re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", pattern)
    regex = "^" + regex + "$"

    def deco(handler):
        ROUTES.append((method, re.compile(regex), keys, handler))
        return handler

    return deco


class ApiError(Exception):
    def __init__(self, status, message, details=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.details = details or {}


def find_route(method, path):
    for m, regex, keys, handler in ROUTES:
        if m == method:
            match = regex.match(path)
            if match:
                return handler, match.groupdict()
    return None, {}


def read_body(handler):
    length = int(handler.headers.get("Content-Length") or 0)
    if length == 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise ApiError(400, "请求体不是合法的 JSON")


def query_params(handler):
    parsed = urlparse(handler.path)
    return {k: v[0] for k, v in parse_qs(parsed.query).items()}
