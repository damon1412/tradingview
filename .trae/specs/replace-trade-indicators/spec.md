# 逐笔指标替换：加速度指标 → MACD/RSI

## Why
当前逐笔交易分析面板中的"加速度指标"（`buyAcceleration`/`sellAcceleration`）实际只是每根逐笔的买卖金额，并非真正的加速度指标，且无法提供有效的交易信号。需要替换为 MACD 和 RSI 这两个经典技术指标。

## What Changes
- 移除 `buyAcceleration` 和 `sellAcceleration` 数据字段
- 新增逐笔数据 MACD 计算（基于价格序列）
- 新增逐笔数据 RSI 计算（基于价格序列）
- `TradeIndicatorChart` 组件支持累计买卖、MACD、RSI 三种指标切换
- 更新类型定义

## Impact
- Affected specs: 逐笔交易分析指标
- Affected code: `types/stock.ts`, `utils/tradeData.ts`, `components/TradeIndicatorChart.tsx`

## ADDED Requirements
### Requirement: MACD指标计算
系统 SHALL 对逐笔价格序列计算 MACD(12,26,9) 指标。

### Requirement: RSI指标计算
系统 SHALL 对逐笔价格序列计算 RSI(14) 指标。

### Requirement: 指标切换
系统 SHALL 允许用户在累计买卖、MACD、RSI 三种指标之间切换显示。

## MODIFIED Requirements
### Requirement: TradeIndicatorData 类型
移除 `buyAcceleration` 和 `sellAcceleration` 字段，新增 `macdDIF`、`macdDEA`、`macdHistogram`、`rsi` 字段。

## REMOVED Requirements
### Requirement: 加速度指标
**Reason**: 加速度指标实际无实际意义，且无法提供有效交易信号。
**Migration**: 替换为 MACD 和 RSI 指标。
