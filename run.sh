#!/usr/bin/env bash
# 一键启动艺术作品借展与运输交接系统：bash run.sh [端口]
set -e
cd "$(dirname "$0")/loan-system/server"
PORT="${1:-8000}"
echo "启动中... 浏览器打开 http://127.0.0.1:${PORT}"
exec python3 app.py --port "${PORT}"
