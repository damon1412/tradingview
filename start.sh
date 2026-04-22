#!/bin/bash

echo "========================================="
echo "  股票成交量分析工具 (TradeView)"
echo "========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请先安装 Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "[1/3] Node.js 版本: $(node -v)"
echo "[2/3] 检查依赖..."

# 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo "      正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
fi

echo "[3/3] 启动开发服务器..."
echo ""
echo "========================================="
echo "  访问地址: http://localhost:3266"
echo "  按 Ctrl+C 停止服务器"
echo "========================================="
echo ""

# 启动开发服务器
npm run dev
