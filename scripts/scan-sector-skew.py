#!/usr/bin/env python3
"""概念板块偏度扫描预计算脚本 - 支持历史记录/轮动分析/成员股扫描/多周期"""

import duckdb
import json
import math
import argparse
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict

DB_PATH = Path(__file__).parent.parent / 'dbs' / 'tdx.db'
PUBLIC_DIR = Path(__file__).parent.parent / 'public'

DATA_FILE = PUBLIC_DIR / 'sector-skew-data.json'
HISTORY_FILE = PUBLIC_DIR / 'sector-skew-history.json'
ROTATION_FILE = PUBLIC_DIR / 'sector-rotation.json'
MEMBERS_FILE = PUBLIC_DIR / 'sector-members-data.json'
MULTI_CYCLE_FILE = PUBLIC_DIR / 'sector-multi-cycle.json'

CALC_WINDOW_DAY = 20
CALC_WINDOW_WEEK = 8
CALC_WINDOW_MONTH = 6
HISTORY_MAX_DAYS = 60


def calculate_volatility(prices, window=CALC_WINDOW_DAY):
    if len(prices) < window + 1:
        return None
    recent_prices = prices[-(window + 1):]
    returns = []
    for i in range(1, len(recent_prices)):
        if recent_prices[i - 1] > 0:
            ret = (recent_prices[i] - recent_prices[i - 1]) / recent_prices[i - 1]
            returns.append(ret)
    if len(returns) < 3:
        return None
    up_returns = [r for r in returns if r > 0]
    down_returns = [r for r in returns if r < 0]
    if len(up_returns) < 2 or len(down_returns) < 2:
        return None
    up_mean = sum(up_returns) / len(up_returns)
    down_mean = sum(down_returns) / len(down_returns)
    up_var = sum((r - up_mean) ** 2 for r in up_returns) / (len(up_returns) - 1)
    down_var = sum((r - down_mean) ** 2 for r in down_returns) / (len(down_returns) - 1)
    up_vol = math.sqrt(up_var) * 100
    down_vol = math.sqrt(down_var) * 100
    if down_vol == 0:
        return None
    vol_skew = up_vol / down_vol
    volatility = math.sqrt((up_var + down_var) / 2) * 100 if len(returns) > 1 else 0
    return {
        'volSkew': round(vol_skew, 3),
        'upVolatility': round(up_vol, 3),
        'downVolatility': round(down_vol, 3),
        'volatility': round(volatility, 3)
    }


def scan_sectors(block_type='concept', conn=None):
    own_conn = conn is None
    if own_conn:
        conn = duckdb.connect(str(DB_PATH))
    blocks = conn.execute(f"""
        SELECT block_symbol, block_name, block_code
        FROM raw_tdx_blocks_info
        WHERE block_type = '{block_type}'
        ORDER BY block_symbol
    """).fetchall()
    print(f'  找到 {len(blocks)} 个{block_type}板块')
    results = []
    errors = []
    for idx, (symbol, name, block_code) in enumerate(blocks):
        if (idx + 1) % 50 == 0:
            print(f'    进度: {idx + 1}/{len(blocks)}')
        try:
            daily_data = conn.execute(f"""
                SELECT date, close
                FROM raw_stocks_daily
                WHERE symbol = '{symbol}'
                ORDER BY date ASC
            """).fetchall()
            if len(daily_data) < CALC_WINDOW_DAY + 1:
                errors.append({'symbol': symbol, 'name': name, 'reason': '数据不足'})
                continue
            closes = [row[1] for row in daily_data]
            vol_result = calculate_volatility(closes)
            if vol_result is None:
                errors.append({'symbol': symbol, 'name': name, 'reason': '波动率计算失败'})
                continue
            latest = daily_data[-1]
            prev_close = daily_data[-2][1] if len(daily_data) >= 2 else latest[1]
            change_pct = round((latest[1] - prev_close) / prev_close * 100, 2) if prev_close > 0 else 0
            results.append({
                'symbol': symbol,
                'name': name,
                'blockCode': block_code,
                'latestClose': round(latest[1], 2),
                'latestDate': str(latest[0]),
                'changePct': change_pct,
                **vol_result
            })
        except Exception as e:
            errors.append({'symbol': symbol, 'name': name, 'reason': str(e)})
    if own_conn:
        conn.close()
    return results, errors


def append_history(new_results):
    today_str = datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d')
    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            history = json.load(f)
    else:
        history = {'history': []}
    history['history'].append({
        'date': today_str,
        'scanTime': datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'results': new_results
    })
    if len(history['history']) > HISTORY_MAX_DAYS:
        history['history'] = history['history'][-HISTORY_MAX_DAYS:]
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False)
    print(f'  历史记录已追加，当前共 {len(history["history"])} 天')


def calculate_rotation(today_results):
    if not ROTATION_FILE.exists():
        return None
    with open(ROTATION_FILE, 'r', encoding='utf-8') as f:
        rotation_data = json.load(f)
    yesterday_results = rotation_data.get('results', [])
    today_ranks = {r['symbol']: i + 1 for i, r in enumerate(
        sorted(today_results, key=lambda x: x['volSkew'], reverse=True)
    )}
    yesterday_ranks = {r['symbol']: i + 1 for i, r in enumerate(
        sorted(yesterday_results, key=lambda x: x['volSkew'], reverse=True)
    )}
    rotations = []
    for r in today_results:
        symbol = r['symbol']
        current_rank = today_ranks[symbol]
        prev_rank = yesterday_ranks.get(symbol, len(today_results) + 1)
        rank_change = prev_rank - current_rank
        rotations.append({
            'symbol': symbol,
            'name': r['name'],
            'currentRank': current_rank,
            'prevRank': prev_rank,
            'rankChange': rank_change,
            'trend': 'rising' if rank_change > 0 else ('falling' if rank_change < 0 else 'stable'),
            'volSkew': r['volSkew']
        })
    rotations.sort(key=lambda x: x['rankChange'], reverse=True)
    return rotations


def save_rotation(rotations, today_results):
    today_str = datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d')
    rotation_data = {
        'date': today_str,
        'scanTime': datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'results': today_results,
        'rotations': rotations
    }
    with open(ROTATION_FILE, 'w', encoding='utf-8') as f:
        json.dump(rotation_data, f, ensure_ascii=False)


def scan_all_members():
    conn = duckdb.connect(str(DB_PATH))
    members = conn.execute("""
        SELECT bm.stock_symbol, bi.block_symbol, bi.block_name, sn.name as stock_name
        FROM raw_tdx_blocks_member bm
        JOIN raw_tdx_blocks_info bi ON bm.block_code = bi.block_code
        LEFT JOIN raw_stock_names sn ON bm.stock_symbol = sn.symbol
        WHERE bi.block_type = 'concept'
        ORDER BY bi.block_symbol, bm.stock_symbol
    """).fetchall()
    print(f'  找到 {len(members)} 条成员关系')
    block_members = defaultdict(list)
    unique_stocks = set()
    for stock_symbol, block_symbol, block_name, stock_name in members:
        block_members[block_symbol].append({
            'stock_symbol': stock_symbol,
            'stock_name': stock_name or stock_symbol,
            'block_name': block_name
        })
        unique_stocks.add(stock_symbol)
    print(f'  唯一股票数: {len(unique_stocks)}')
    stock_skew = {}
    sorted_stocks = sorted(unique_stocks)
    for idx, stock_symbol in enumerate(sorted_stocks):
        if (idx + 1) % 500 == 0:
            print(f'    扫描进度: {idx + 1}/{len(sorted_stocks)}')
        try:
            daily_data = conn.execute(f"""
                SELECT close
                FROM raw_stocks_daily
                WHERE symbol = '{stock_symbol}'
                ORDER BY date ASC
            """).fetchall()
            if len(daily_data) < CALC_WINDOW_DAY + 1:
                continue
            closes = [row[0] for row in daily_data]
            vol_result = calculate_volatility(closes)
            if vol_result is None:
                continue
            latest = daily_data[-1][0]
            prev_close = daily_data[-2][0] if len(daily_data) >= 2 else latest
            change_pct = round((latest - prev_close) / prev_close * 100, 2) if prev_close > 0 else 0
            stock_skew[stock_symbol] = {
                'symbol': stock_symbol,
                'latestClose': round(latest, 2),
                'changePct': change_pct,
                **vol_result
            }
        except Exception:
            pass
    result = {}
    for block_symbol, m_list in block_members.items():
        block_results = []
        for m in m_list:
            if m['stock_symbol'] in stock_skew:
                block_results.append({
                    **stock_skew[m['stock_symbol']],
                    'blockName': m['block_name'],
                    'stockName': m['stock_name']
                })
        if block_results:
            result[block_symbol] = sorted(block_results, key=lambda x: x['volSkew'], reverse=True)
    conn.close()
    print(f'  板块成员扫描完成: {len(result)} 个板块有数据')
    return result


def scan_multi_cycle():
    conn = duckdb.connect(str(DB_PATH))
    blocks = conn.execute("""
        SELECT block_symbol, block_name
        FROM raw_tdx_blocks_info
        WHERE block_type = 'concept'
        ORDER BY block_symbol
    """).fetchall()
    result = []
    for idx, (symbol, name) in enumerate(blocks):
        if (idx + 1) % 50 == 0:
            print(f'    多周期进度: {idx + 1}/{len(blocks)}')
        try:
            daily_data = conn.execute(f"""
                SELECT close
                FROM raw_stocks_daily
                WHERE symbol = '{symbol}'
                ORDER BY date ASC
            """).fetchall()
            closes = [row[0] for row in daily_data]
            day_result = calculate_volatility(closes, CALC_WINDOW_DAY)
            week_data = _resample_to_weekly(closes)
            week_result = calculate_volatility(week_data, CALC_WINDOW_WEEK) if len(week_data) >= CALC_WINDOW_WEEK + 1 else None
            month_data = _resample_to_monthly(closes)
            month_result = calculate_volatility(month_data, CALC_WINDOW_MONTH) if len(month_data) >= CALC_WINDOW_MONTH + 1 else None
            entry = {
                'symbol': symbol,
                'name': name,
                'day': day_result,
                'week': week_result,
                'month': month_result
            }
            if day_result or week_result or month_result:
                result.append(entry)
        except Exception:
            pass
    conn.close()
    print(f'  多周期扫描完成: {len(result)} 个板块')
    return result


def _resample_to_weekly(closes):
    weekly = []
    for i in range(len(closes)):
        if i % 5 == 4 or i == len(closes) - 1:
            weekly.append(closes[i])
    return weekly


def _resample_to_monthly(closes):
    monthly = []
    for i in range(len(closes)):
        if i % 20 == 19 or i == len(closes) - 1:
            monthly.append(closes[i])
    return monthly


def backfill_history(days=60):
    conn = duckdb.connect(str(DB_PATH))
    blocks = conn.execute("""
        SELECT block_symbol, block_name, block_code
        FROM raw_tdx_blocks_info
        WHERE block_type = 'concept'
        ORDER BY block_symbol
    """).fetchall()

    print(f'  获取 {len(blocks)} 个板块的历史数据...')

    all_daily = conn.execute("""
        SELECT symbol, date, close
        FROM raw_stocks_daily
        WHERE symbol IN (SELECT block_symbol FROM raw_tdx_blocks_info WHERE block_type = 'concept')
        ORDER BY symbol, date ASC
    """).fetchall()

    block_data = defaultdict(list)
    for symbol, date, close in all_daily:
        block_data[symbol].append((date, close))

    history = {'history': []}
    today = datetime.now(timezone(timedelta(hours=8)))

    for days_ago in range(days, 0, -1):
        target_date = (today - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        day_results = []

        for symbol, name, block_code in blocks:
            data = block_data.get(symbol, [])
            target_idx = None
            for i, (d, _) in enumerate(data):
                if str(d) == target_date:
                    target_idx = i
                    break
            if target_idx is None:
                continue

            window_start = max(0, target_idx - CALC_WINDOW_DAY)
            closes = [row[1] for row in data[window_start:target_idx + 1]]

            vol_result = calculate_volatility(closes)
            if vol_result is None:
                continue

            latest_close = data[target_idx][1]
            prev_close = data[target_idx - 1][1] if target_idx > 0 else latest_close
            change_pct = round((latest_close - prev_close) / prev_close * 100, 2) if prev_close > 0 else 0

            day_results.append({
                'symbol': symbol,
                'name': name,
                'blockCode': block_code,
                'latestClose': round(latest_close, 2),
                'latestDate': str(data[target_idx][0]),
                'changePct': change_pct,
                **vol_result
            })

        if day_results:
            history['history'].append({
                'date': target_date,
                'scanTime': (today - timedelta(days=days_ago)).isoformat(),
                'results': sorted(day_results, key=lambda x: x['volSkew'], reverse=True)
            })

        if (days - days_ago + 1) % 10 == 0:
            print(f'    回溯进度: {days - days_ago + 1}/{days} 天')

    conn.close()

    if len(history['history']) > HISTORY_MAX_DAYS:
        history['history'] = history['history'][-HISTORY_MAX_DAYS:]

    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False)

    print(f'  回溯完成: {len(history["history"])} 天')

    if len(history['history']) >= 2:
        prev_results = history['history'][-2]['results']
        curr_results = history['history'][-1]['results']
        today_ranks = {r['symbol']: i + 1 for i, r in enumerate(sorted(curr_results, key=lambda x: x['volSkew'], reverse=True))}
        prev_ranks = {r['symbol']: i + 1 for i, r in enumerate(sorted(prev_results, key=lambda x: x['volSkew'], reverse=True))}

        rotations = []
        for r in curr_results:
            symbol = r['symbol']
            current_rank = today_ranks[symbol]
            prev_rank = prev_ranks.get(symbol, len(curr_results) + 1)
            rank_change = prev_rank - current_rank
            rotations.append({
                'symbol': symbol,
                'name': r['name'],
                'currentRank': current_rank,
                'prevRank': prev_rank,
                'rankChange': rank_change,
                'trend': 'rising' if rank_change > 0 else ('falling' if rank_change < 0 else 'stable'),
                'volSkew': r['volSkew']
            })
        rotations.sort(key=lambda x: x['rankChange'], reverse=True)

        rotation_data = {
            'date': history['history'][-1]['date'],
            'scanTime': history['history'][-1]['scanTime'],
            'results': curr_results,
            'rotations': rotations
        }
        with open(ROTATION_FILE, 'w', encoding='utf-8') as f:
            json.dump(rotation_data, f, ensure_ascii=False)

        rising = len([r for r in rotations if r['trend'] == 'rising'])
        falling = len([r for r in rotations if r['trend'] == 'falling'])
        print(f'  轮动数据: {rising} 上升, {falling} 下降')


def main():
    parser = argparse.ArgumentParser(description='概念板块偏度扫描')
    parser.add_argument('--members', action='store_true', help='扫描全市场成员股')
    parser.add_argument('--multi-cycle', action='store_true', help='多周期扫描')
    parser.add_argument('--all', action='store_true', help='全量扫描（板块+成员股+多周期）')
    parser.add_argument('--backfill', type=int, nargs='?', const=60, default=None, help='回溯历史数据（默认60天）')
    parser.add_argument('--type', default='concept', help='板块类型')
    args = parser.parse_args()

    print('=' * 50)
    print('概念板块偏度扫描器')
    print('=' * 50)

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    today_str = datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d')

    if args.backfill is not None:
        print(f'\n[1/1] 回溯 {args.backfill} 天历史数据...')
        backfill_history(args.backfill)
        print(f'\n{"=" * 50}')
        print(f'回溯完成: {today_str}')
        print(f'{"=" * 50}')
        return

    if args.all or not (args.members or args.multi_cycle):
        print(f'\n[1/4] 扫描概念板块偏度...')
        results, errors = scan_sectors(args.type)
        scan_data = {
            'scanDate': datetime.now(timezone(timedelta(hours=8))).isoformat(),
            'blockType': args.type,
            'calcWindow': CALC_WINDOW_DAY,
            'totalBlocks': len(results) + len(errors),
            'successCount': len(results),
            'errorCount': len(errors),
            'results': sorted(results, key=lambda x: x['volSkew'], reverse=True),
            'errors': errors
        }
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(scan_data, f, ensure_ascii=False, indent=2)
        print(f'  成功: {len(results)} 失败: {len(errors)}')
        print(f'  强势(≥1): {len([r for r in results if r["volSkew"] >= 1])}')
        print(f'  弱势(<1): {len([r for r in results if r["volSkew"] < 1])}')

        print(f'\n[2/4] 追加历史记录...')
        append_history(results)

        print(f'\n[3/4] 计算板块轮动...')
        rotations = calculate_rotation(results)
        if rotations is not None:
            save_rotation(rotations, results)
            rising = len([r for r in rotations if r['trend'] == 'rising'])
            falling = len([r for r in rotations if r['trend'] == 'falling'])
            print(f'  排名上升: {rising} 下降: {falling}')
        else:
            save_rotation([], results)
            print(f'  无昨日数据，初始化轮动记录')

    if args.all or args.members:
        print(f'\n[4/4] 扫描全市场成员股...')
        members_data = scan_all_members()
        members_output = {
            'scanDate': datetime.now(timezone(timedelta(hours=8))).isoformat(),
            'totalBlocks': len(members_data),
            'totalStocks': sum(len(v) for v in members_data.values()),
            'blocks': members_data
        }
        with open(MEMBERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(members_output, f, ensure_ascii=False)

    if args.all or args.multi_cycle:
        print(f'\n[5/5] 多周期扫描...')
        multi_data = scan_multi_cycle()
        multi_output = {
            'scanDate': datetime.now(timezone(timedelta(hours=8))).isoformat(),
            'blocks': multi_data
        }
        with open(MULTI_CYCLE_FILE, 'w', encoding='utf-8') as f:
            json.dump(multi_output, f, ensure_ascii=False, indent=2)

    print(f'\n{"=" * 50}')
    print(f'扫描完成: {today_str}')
    print(f'{"=" * 50}')


if __name__ == '__main__':
    main()
