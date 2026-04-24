#!/bin/bash
# 概念板块偏度扫描 - 每日自动扫描脚本
# 使用方法: 
#   1. crontab -e
#   2. 添加: 35 15 * * 1-5 /Users/jiashen/WorkBuddy/Claw/tradingview/scripts/daily-scan.sh >> /tmp/sector-scan.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "每日板块偏度扫描 - $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

cd "$PROJECT_DIR"
python3 scripts/scan-sector-skew.py --all

echo ""
echo "扫描完成: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
