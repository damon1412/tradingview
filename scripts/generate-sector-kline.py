#!/usr/bin/env python3
"""生成板块K线数据JSON文件，用于前端筹码分布分析"""

import duckdb
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta

DB_PATH = Path(__file__).parent.parent / 'dbs' / 'tdx.db'
PUBLIC_DIR = Path(__file__).parent.parent / 'public'
SECTOR_KLINE_DIR = PUBLIC_DIR / 'sector-kline-data'


def generate_sector_kline(sector_code: str, days: int = 250):
    conn = duckdb.connect(str(DB_PATH))
    
    sector_info = conn.execute("""
        SELECT block_symbol, block_name
        FROM raw_tdx_blocks_info
        WHERE block_symbol = ?
    """, [sector_code]).fetchone()
    
    if not sector_info:
        conn.close()
        return None
    
    symbol, name = sector_info
    
    daily_data = conn.execute("""
        SELECT date, open, high, low, close, amount, volume
        FROM raw_stocks_daily
        WHERE symbol = ?
        ORDER BY date DESC
        LIMIT ?
    """, [symbol, days]).fetchall()
    
    conn.close()
    
    if not daily_data:
        return None
    
    daily_data.reverse()
    
    result = []
    for date, open_price, high, low, close, amount, volume in daily_data:
        result.append({
            'symbol': symbol,
            'date': str(date),
            'open': round(open_price, 2),
            'high': round(high, 2),
            'low': round(low, 2),
            'close': round(close, 2),
            'amount': round(amount, 2),
            'volume': int(volume)
        })
    
    return {
        'code': 0,
        'message': 'success',
        'data': {
            'symbol': symbol,
            'name': name,
            'klines': result
        }
    }


def main():
    parser = argparse.ArgumentParser(description='生成板块K线数据')
    parser.add_argument('--code', type=str, help='板块代码（如 sh880660）')
    parser.add_argument('--days', type=int, default=250, help='天数（默认250）')
    parser.add_argument('--all', action='store_true', help='生成所有板块数据')
    args = parser.parse_args()
    
    SECTOR_KLINE_DIR.mkdir(parents=True, exist_ok=True)
    
    conn = duckdb.connect(str(DB_PATH))
    
    if args.code:
        result = generate_sector_kline(args.code, args.days)
        if result:
            output_file = SECTOR_KLINE_DIR / f'{args.code}.json'
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False)
            print(f'已生成: {output_file}')
            print(f'  板块: {result["data"]["name"]}')
            print(f'  K线数: {len(result["data"]["klines"])}')
        else:
            print(f'未找到板块: {args.code}')
    elif args.all:
        blocks = conn.execute("""
            SELECT block_symbol, block_name
            FROM raw_tdx_blocks_info
            WHERE block_type = 'concept'
            ORDER BY block_symbol
        """).fetchall()
        
        print(f'找到 {len(blocks)} 个概念板块')
        
        for idx, (symbol, name) in enumerate(blocks):
            if (idx + 1) % 50 == 0:
                print(f'  进度: {idx + 1}/{len(blocks)}')
            
            result = generate_sector_kline(symbol, 250)
            if result:
                output_file = SECTOR_KLINE_DIR / f'{symbol}.json'
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False)
        
        print(f'\n完成! 共生成 {len(blocks)} 个板块数据')
    else:
        print('请使用 --code <板块代码> 或 --all 参数')
    
    conn.close()


if __name__ == '__main__':
    main()
