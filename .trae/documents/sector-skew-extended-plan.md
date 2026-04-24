# 概念板块偏度扫描器 - 扩展实施方案

## 一、需求确认

| 项目 | 参数 |
|------|------|
| 历史记录保留 | 60 天 |
| 扫描频率 | 每日自动（cron job） |
| 成员股扫描范围 | 全市场（270板块 × ~100股/板块 ≈ 27000股） |

## 二、架构设计

### 2.1 数据流

```
每天收盘后 (15:30)
    ↓
cron job 触发扫描脚本
    ↓
┌─ 扫描日线偏度 → sector-skew-data.json
├─ 追加历史记录 → sector-skew-history.json (保留60天)
├─ 计算轮动分析 → sector-rotation.json
├─ 扫描全市场成员股 → sector-members-data.json
└─ 多周期扫描 → sector-multi-cycle.json (日/周/月)
    ↓
前端页面加载 JSON 展示
```

### 2.2 数据存储

| 文件 | 内容 | 大小预估 |
|------|------|----------|
| `sector-skew-data.json` | 最新270个板块扫描结果 | ~100KB |
| `sector-skew-history.json` | 60天历史记录 | ~6MB |
| `sector-rotation.json` | 板块排名变化 | ~50KB |
| `sector-members-data.json` | 全市场成员股偏度 | ~5MB |
| `sector-multi-cycle.json` | 日/周/月多周期数据 | ~300KB |

### 2.3 cron job 配置

```bash
# 每天 15:35 执行（收盘后5分钟）
35 15 * * 1-5 cd /Users/jiashen/WorkBuddy/Claw/tradingview && python3 scripts/scan-sector-skew.py --all >> /tmp/sector-scan.log 2>&1
```

## 三、实施阶段

### 阶段一：升级预计算脚本 + 历史记录

**任务**：
1. 修改 `scan-sector-skew.py` 支持历史记录追加
2. 实现 60 天自动清理
3. 支持 `--all` 参数执行全量扫描

**输出**：
- `sector-skew-history.json` 格式正确
- cron job 配置脚本

### 阶段二：偏度趋势追踪

**任务**：
1. 创建 `SectorTrendChart.tsx` 组件
2. 使用 Recharts 绘制偏度比走势
3. 前端集成到板块行展开视图

### 阶段三：板块轮动分析

**任务**：
1. 脚本中计算排名变化
2. 生成 `sector-rotation.json`
3. 创建 `SectorRotationView.tsx` 组件
4. 热力图/排行榜展示

### 阶段四：成员股扫描

**任务**：
1. 创建 `scan-sector-members.py` 脚本
2. 查询所有板块成员关系
3. 批量计算成员股偏度比（分批+进度）
4. 创建 `SectorMembersView.tsx` 组件

### 阶段五：多周期对比

**任务**：
1. 脚本支持周线/月线偏度计算
2. 生成 `sector-multi-cycle.json`
3. 前端多周期对比表格
4. 三周期共振信号标识

## 四、关键实现细节

### 4.1 历史记录追加逻辑

```python
def append_history(new_results):
    history_file = Path('public/sector-skew-history.json')
    
    if history_file.exists():
        with open(history_file) as f:
            history = json.load(f)
    else:
        history = {'history': []}
    
    history['history'].append({
        'date': today_str,
        'results': new_results
    })
    
    # 保留60天
    if len(history['history']) > 60:
        history['history'] = history['history'][-60:]
    
    with open(history_file, 'w') as f:
        json.dump(history, f)
```

### 4.2 轮动分析计算

```python
def calculate_rotation(today_results, yesterday_results):
    rotations = []
    
    today_ranks = {r['symbol']: i+1 for i, r in enumerate(
        sorted(today_results, key=lambda x: x['volSkew'], reverse=True)
    )}
    
    yesterday_ranks = {r['symbol']: i+1 for i, r in enumerate(
        sorted(yesterday_results, key=lambda x: x['volSkew'], reverse=True)
    )}
    
    for symbol in today_results:
        current_rank = today_ranks[symbol]
        prev_rank = yesterday_ranks.get(symbol, len(today_results) + 1)
        rank_change = prev_rank - current_rank  # 正数=排名上升
        
        rotations.append({
            'symbol': symbol,
            'currentRank': current_rank,
            'prevRank': prev_rank,
            'rankChange': rank_change,
            'trend': 'rising' if rank_change > 0 else 'falling'
        })
    
    return sorted(rotations, key=lambda x: x['rankChange'], reverse=True)
```

### 4.3 成员股扫描优化

```python
def scan_all_members():
    # 1. 获取所有板块成员关系
    members = conn.execute("""
        SELECT bm.stock_symbol, bm.block_code, bi.block_symbol, bi.block_name
        FROM raw_tdx_blocks_member bm
        JOIN raw_tdx_blocks_info bi ON bm.block_code = bm.block_code
        WHERE bi.block_type = 'concept'
    """).fetchall()
    
    # 2. 按板块分组
    block_members = defaultdict(list)
    for stock_symbol, block_code, block_symbol, block_name in members:
        block_members[block_symbol].append({
            'stock_symbol': stock_symbol,
            'block_name': block_name
        })
    
    # 3. 批量扫描（避免重复查询同一股票）
    unique_stocks = set(m['stock_symbol'] for m in sum(block_members.values(), []))
    stock_skew = batch_scan_stocks(unique_stocks)
    
    # 4. 组装结果
    results = {}
    for block_symbol, members in block_members.items():
        block_results = []
        for m in members:
            if m['stock_symbol'] in stock_skew:
                block_results.append({
                    **stock_skew[m['stock_symbol']],
                    'block_symbol': block_symbol,
                    'block_name': members[0]['block_name']
                })
        results[block_symbol] = sorted(block_results, key=lambda x: x['volSkew'], reverse=True)
    
    return results
```

### 4.4 前端性能优化

- 成员股表格使用虚拟滚动（仅渲染可视区域）
- 历史趋势图使用数据采样（60天 → 显示30个数据点）
- 轮动热力图使用 Canvas 渲染

## 五、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| JSON 文件过大 | 加载慢 | 限制60天，定期清理 |
| 成员股扫描耗时 | 脚本运行时间长 | 分批查询，进度日志 |
| cron job 失败 | 数据缺失 | 错误日志 + 告警 |
| 前端渲染大量数据 | 页面卡顿 | 虚拟滚动 + 分页 |

## 六、验收标准

- [ ] 脚本每天 15:35 自动执行
- [ ] 历史记录保留 60 天可查询
- [ ] 270 个板块偏度数据准确
- [ ] 全市场成员股扫描完成（~27000 股）
- [ ] 前端趋势图/轮动视图/成员股视图正常展示
- [ ] 多周期数据对比可用
