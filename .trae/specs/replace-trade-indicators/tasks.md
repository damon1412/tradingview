# 逐笔指标替换：加速度指标 → MACD/RSI - 任务分解

## Task 1: 更新类型定义
**路径**: `src/types/stock.ts`
- [x] 从 `TradeIndicatorData` 接口移除 `buyAcceleration` 和 `sellAcceleration` 字段
- [x] 新增 `macdDIF: number[]`、`macdDEA: number[]`、`macdHistogram: number[]`、`rsi: number[]` 字段

## Task 2: 实现 MACD 和 RSI 计算函数
**路径**: `src/utils/tradeData.ts`
- [x] 实现 `calculateMACD(prices: number[], fast=12, slow=26, signal=9)` 函数
- [x] 实现 `calculateRSI(prices: number[], period=14)` 函数
- [x] 更新 `calculateTradeIndicators` 函数，使用 MACD/RSI 替代加速度

## Task 3: 更新 TradeIndicatorChart 组件
**路径**: `src/components/TradeIndicatorChart.tsx`
- [x] 支持三种指标模式：累计买卖、MACD、RSI
- [x] MACD 显示 DIF/DEA 两条线 + 柱状图
- [x] RSI 显示一条线 + 超买(70)/超卖(30)参考线
- [x] 切换按钮支持循环切换三种模式

## Task 4: 测试验证
- [ ] 平安银行逐笔数据下三种指标都正常显示
- [ ] 无控制台错误
- [x] TypeScript 编译通过

## 任务依赖关系

```
Task 1 (类型定义) → Task 2 (计算函数) → Task 3 (图表组件) → Task 4 (测试验证)
```
