#!/bin/bash

echo "========================================="
echo "  停止 TradeView 开发服务器"
echo "========================================="
echo ""

# 查找并停止 webpack dev server 进程
PID=$(lsof -ti:3266 2>/dev/null)

if [ -z "$PID" ]; then
    echo "未找到运行中的开发服务器 (端口 3266)"
    exit 0
fi

echo "找到进程: $PID"
kill -9 $PID 2>/dev/null

if [ $? -eq 0 ]; then
    echo "开发服务器已停止"
else
    echo "停止失败"
    exit 1
fi
