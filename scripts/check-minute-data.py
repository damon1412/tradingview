#!/usr/bin/env python3
import duckdb
conn = duckdb.connect('dbs/tdx.db')

tables = ['raw_stocks_5min', 'raw_stocks_15min', 'raw_stocks_30min', 'raw_stocks_60min']

for table in tables:
    print(f'=== {table} ===')
    try:
        count = conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
        print(f'总记录数: {count}')
        
        if count > 0:
            sh88_count = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE symbol LIKE 'sh88%'").fetchone()[0]
            print(f'板块指数记录数 (sh88开头): {sh88_count}')
            
            if sh88_count > 0:
                sample = conn.execute(f"SELECT DISTINCT symbol FROM {table} WHERE symbol LIKE 'sh88%' LIMIT 5").fetchall()
                print(f'示例: {[s[0] for s in sample]}')
                
                first_sample = conn.execute(f"SELECT symbol, date, open, high, low, close FROM {table} WHERE symbol LIKE 'sh88%' LIMIT 3").fetchall()
                print(f'示例数据: {first_sample}')
        
        print()
    except Exception as e:
        print(f'错误: {e}')
        print()

conn.close()
