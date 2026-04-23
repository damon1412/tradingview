# 逐笔指标替换：加速度指标 → MACD/RSI - 检查清单

## 实现前检查
- [x] 确认当前 TradeIndicatorChart 支持累计买卖和加速度两种模式
- [x] 确认逐笔数据可正常获取（A股）

## Task 1 检查：类型定义
- [x] `TradeIndicatorData` 接口已移除 `buyAcceleration` 和 `sellAcceleration`
- [x] `TradeIndicatorData` 接口已新增 `macdDIF`、`macdDEA`、`macdHistogram`、`rsi`
- [x] TypeScript 编译通过

## Task 2 检查：MACD/RSI 计算
- [x] `calculateMACD` 函数实现正确（EMA12-EMA26, Signal=9）
- [x] `calculateRSI` 函数实现正确（RSI14）
- [x] `calculateTradeIndicators` 返回新字段

## Task 3 检查：图表组件
- [x] 累计买卖模式正常工作
- [x] MACD 模式显示 DIF、DEA 线 + 柱状图
- [x] RSI 模式显示 RSI 线 + 超买(70)/超卖(30)参考线
- [x] 切换按钮支持三种模式循环切换
- [x] 鼠标悬停显示正确数据

## Task 4 检查：测试验证
- [ ] 平安银行逐笔数据下三种指标都正常显示
- [ ] 无控制台错误
- [x] TypeScript 编译通过

## 代码质量检查
- [x] 无未使用的导入或变量
- [x] 遵循项目代码风格
- [x] 无 TypeScript 类型错误
