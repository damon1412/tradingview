# 信号扫描器计算逻辑与参数分析报告

> 生成日期：2026-04-25
> 分析范围：信号扫描器完整计算链路，涵盖数据获取、六层偏度分析框架、信号评分系统、多周期一致性分析
> 代码版本：commit 17cc87c0

---

## 一、系统架构总览

### 1.1 模块依赖关系

```
SignalScannerPage.tsx（扫描器页面）
  ├── stockApi.ts（数据获取层）
  │     ├── getKlineData()          → 调用 /api/kline 或 /api/index
  │     └── convertKlineToStockData() → 新浪数据格式转换
  ├── stockData.ts（核心计算层）
  │     ├── analyzeVolatilitySkew()     → 六层偏度分析
  │     ├── generateTradingSignal()     → 信号评分与映射
  │     └── analyzeMultiPeriodConsistency() → 多周期一致性
  └── types/stock.ts（类型定义层）
        ├── VolatilitySkewAnalysis      → 分析结果类型
        └── TradingSignalResult         → 信号结果类型

SignalPanel.tsx（单股信号面板）
  └── 展示 TradingSignalResult 详细信息

App.tsx（主页面）
  └── stockApi.ts → analyzeAllPeriods() → 多周期分析
```

### 1.2 关键文件清单

| 文件路径 | 行数 | 职责 |
|----------|------|------|
| `src/utils/stockData.ts` | 673 | 核心计算函数：偏度分析、信号生成、多周期一致性 |
| `src/services/stockApi.ts` | 454 | API调用、数据转换、多周期分析入口 |
| `src/components/SignalScannerPage.tsx` | 428 | 扫描器页面UI与交互逻辑 |
| `src/components/SignalPanel.tsx` | 213 | 单股信号折叠面板展示 |
| `src/types/stock.ts` | 166 | 类型定义（12个新增类型） |

---

## 二、数据获取层

### 2.1 API调用方式

扫描器通过 `scanSingle()` 函数逐个获取目标股票数据：

```typescript
const scanSingle = useCallback(async (target: ScannerTarget) => {
  const result = await getKlineData(target.code, 'day');
  if (result.error || !result.data) return { target, analysis: null, signalResult: null };
  const stockData = convertKlineToStockData(result.data.List);
  const analysis = analyzeVolatilitySkew(stockData, window, 0.05);
  if (!analysis) return { target, analysis: null, signalResult: null };
  const signal = generateTradingSignal(analysis);
  return { target, analysis, signalResult: signal };
}, [window]);
```

**API请求格式**：

```
GET /api/{apiType}?code={code}&type=day
```

| 参数 | 值 | 判定逻辑 |
|------|------|----------|
| `apiType` | `kline`（个股）或 `index`（指数） | 通过 `LOCAL_INDEX_LIST` 集合判断代码是否为指数 |
| `type` | 固定为 `day` | 扫描器仅使用日线数据 |
| `code` | 如 `sh880656`、`sz002028` | 保持原始代码格式 |

### 2.2 API返回数据量

新浪K线API默认返回约 **100条** 日线数据。实际测试结果：

| 股票/指数 | 返回条数 | 说明 |
|-----------|----------|------|
| 普通个股 | ~100条 | 如 sz002028 |
| 板块指数 | ~100条 | 如 sh880656 |
| 主要指数 | ~100条 | 如 sh000001 |

**影响**：100条日线数据在扣除1条用于计算收益率后，剩余99条returns，直接影响后续分析窗口的有效性。

### 2.3 数据转换逻辑

`convertKlineToStockData()` 函数将新浪API原始数据转换为内部 `StockData` 格式：

```typescript
{
  timestamp: new Date(item.Time).getTime(),
  open:   item.Open / 1000,    // 新浪价格需除以1000
  high:   item.High / 1000,
  low:    item.Low / 1000,
  close:  item.Close / 1000,
  volume: item.Volume           // 成交量不除以1000
}
```

转换后按时间**升序**排列（API返回为倒序）。

### 2.4 数据质量风险

**已发现问题**：部分股票历史数据中存在 `Close=0` 或 `Open≤0` 的异常记录。例如 sz002028（思源电气）在2006年的5条数据中 Close=0，导致收益率计算出现除零，产生 Infinity/NaN。

**当前状态**：`calculateVolatility()` 函数中已添加过滤逻辑（`prevClose <= 0 || currClose <= 0`），但 `analyzeVolatilitySkew()` 函数中**未添加**此过滤，存在NaN风险。

---

## 三、核心计算层 — `analyzeVolatilitySkew()`

### 3.1 函数签名与参数

```typescript
function analyzeVolatilitySkew(
  data: StockData[],
  window: number = 60,
  deadZone: number = 0.05
): VolatilitySkewAnalysis | null
```

| 参数 | 默认值 | 用户可调范围 | 说明 |
|------|--------|-------------|------|
| `data` | — | — | StockData数组，约100条日线 |
| `window` | 60 | 10~120（扫描器UI可调） | 期望的分析窗口大小 |
| `deadZone` | 0.05 | 固定，不可调 | 死区阈值，±5%偏差范围内视为正常 |

### 3.2 收益率计算

```typescript
returns[i] = (data[i].close - data[i-1].close) / data[i-1].close
```

- 100条原始数据 → 99条收益率
- **未过滤** close ≤ 0 的异常数据（与 `calculateVolatility()` 不一致）

### 3.3 自适应窗口机制

由于API返回数据量有限（~100条），实际使用的分析窗口会根据数据量自动调整：

```typescript
const effectiveWindow = Math.min(window, Math.max(Math.floor(returns.length * 0.4), 20));
```

**各数据量下的实际窗口**：

| returns长度 | window=60时effectiveWindow | window=30时effectiveWindow | 说明 |
|-------------|---------------------------|---------------------------|------|
| 150 | 60 | 30 | 数据充足，使用设定值 |
| 99 | 39 | 30 | 60窗口被压缩为39 |
| 80 | 32 | 30 | 60窗口被压缩为32 |
| 50 | 20 | 20 | 降级到最低值20 |
| 29 | null | null | 数据不足，返回null |

**最低数据要求**：`returns.length >= effectiveWindow * 1.5`

| effectiveWindow | 最低returns长度 |
|-----------------|----------------|
| 60 | 90 |
| 39 | 58 |
| 20 | 30 |

### 3.4 当前窗口与历史窗口划分

```typescript
currentReturns = returns.slice(-effectiveWindow)    // 最新N天
historicalReturns = returns.slice(0, -effectiveWindow)  // 更早的数据
```

**以100条数据为例**（returns=99，effectiveWindow=39）：

```
|<--- 历史窗口 (60条) --->|<--- 当前窗口 (39条) --->|
[0]                    [59] [60]                   [98]
```

- 当前窗口：最新39天收益率，用于计算当前偏度状态
- 历史窗口：前60天收益率，用于生成历史参考基线

### 3.5 辅助函数

**标准差计算**（样本标准差，分母 n-1）：

```typescript
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
```

**均值计算**：

```typescript
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
```

---

## 四、六层偏度分析框架详解

### 4.1 Layer 1: 波动率水平

**核心指标**：波动率比率 `volRatio`

**计算过程**：

```typescript
// 当前窗口
currentVol = stdDev(currentReturns)                    // 当前收益率标准差

// 历史参考（滚动窗口生成多个样本）
for each historicalChunk:
  historicalVolValues.push(stdDev(chunkReturns))       // 各段历史波动率

meanVol = mean(historicalVolValues)                    // 历史波动率均值
volRatio = currentVol / meanVol                        // 波动率比率
```

**分类阈值**：

| volRatio 范围 | 级别 | 含义 | 颜色标识 |
|---------------|------|------|----------|
| < 0.80 | 极度压缩 | 当前波动率远低于历史均值 | 蓝色 |
| 0.80 ~ 0.95 | 低于均值 | 当前波动率偏低 | 青色 |
| 0.95 ~ 1.05 | 正常水平 | 当前波动率接近历史均值 | 灰色 |
| 1.05 ~ 1.20 | 偏高 | 当前波动率偏高 | 橙色 |
| > 1.20 | 极端放大 | 当前波动率远高于历史均值 | 红色 |

**解读**：volRatio = 1.0 表示当前波动率与历史均值完全一致；< 0.80 意味着市场处于极度平静状态，可能酝酿变盘。

### 4.2 Layer 2: 偏度方向

**核心指标**：偏度比 `currentSkew`

**计算过程**：

```typescript
currentUpReturns = currentReturns.filter(r => r > 0)    // 上行收益率
currentDownReturns = currentReturns.filter(r => r < 0)  // 下行收益率

currentUpVol = stdDev(currentUpReturns)                  // 上行波动率
currentDownVol = stdDev(currentDownReturns)               // 下行波动率
currentSkew = currentUpVol / currentDownVol               // 偏度比
```

**分类规则**：

| currentSkew | 方向 | 含义 |
|-------------|------|------|
| > 1.0 | 上行主导 | 上行波动 > 下行波动，多头更活跃 |
| < 1.0 | 下行主导 | 下行波动 > 上行波动，空头更活跃 |
| = 1.0 | 多空平衡 | 上下行波动相当 |

**解读**：偏度比 > 1 表示上涨日的波动幅度大于下跌日，市场参与者对上涨的预期更激进；< 1 则相反。

### 4.3 Layer 3: 偏度偏离度

**核心指标**：偏度偏离度 `skewDeviation`

**计算过程**：

```typescript
meanSkew = meanUpVol / meanDownVol                        // 历史偏度均值
skewDeviation = (currentSkew - meanSkew) / meanSkew       // 偏离百分比
```

**分类阈值**：

| skewDeviation 范围 | 级别 | 含义 |
|-------------------|------|------|
| > 0.50 | 极度偏高 | 当前偏度远超历史正常范围 |
| 0.20 ~ 0.50 | 显著偏高 | 当前偏度明显偏高 |
| -0.20 ~ 0.20 | 正常范围 | 偏度接近历史均值 |
| -0.50 ~ -0.20 | 显著偏低 | 当前偏度明显偏低 |
| < -0.50 | 极度偏低 | 当前偏度远低于历史正常范围 |

**解读**：偏度偏离度衡量当前偏度相对于历史均值的异常程度。正值表示当前上行波动比历史更占优，负值表示下行波动更占优。

### 4.4 Layer 4: 驱动类型识别（核心层）

**核心指标**：上行偏离度 `upVolDeviation`、下行偏离度 `downVolDeviation`

**计算过程**：

```typescript
upVolDeviation = (currentUpVol - meanUpVol) / meanUpVol       // 上行偏离度
downVolDeviation = (currentDownVol - meanDownVol) / meanDownVol // 下行偏离度
```

**分类规则**（基于死区 `deadZone = 0.05`，即 ±5%）：

| upVolDeviation | downVolDeviation | 驱动类型 | 含义 | 典型场景 |
|----------------|------------------|----------|------|----------|
| > +5% | < -5% | 多头进攻型 | 上行波动放大 + 下行波动收缩 | 牛市加速上涨 |
| < -5% | > +5% | 空头进攻型 | 上行波动收缩 + 下行波动放大 | 熊市加速下跌 |
| > +5% | > +5% | 波动放大型 | 上下行波动同时放大 | 重大事件前后 |
| < -5% | < -5% | 波动收缩型 | 上下行波动同时收缩 | 盘整蓄势期 |
| 在±5%内 | 在±5%内 | 无明显驱动特征 | 偏离度在死区内 | 常态市场 |

**死区机制的意义**：避免微小波动被误判为趋势信号。只有当偏离度超过5%时才认为存在统计显著的驱动力量。

### 4.5 Layer 5: 成交量分析

**核心指标**：量比 `volumeRatio`、量偏度 `volumeSkew`

**计算过程**：

```typescript
// 当前窗口成交量
currentVolume = mean(currentWindowData.map(d => d.volume))              // 平均日成交量
currentUpVolumeAvg = mean(currentWindowData.filter(d => close > open).map(d => d.volume))   // 阳线均量
currentDownVolumeAvg = mean(currentWindowData.filter(d => close < open).map(d => d.volume))  // 阴线均量

// 历史参考成交量
for each historicalChunk:
  historicalVolumeValues.push(mean(chunkData.map(d => d.volume)))       // 各段历史均量

meanVolume = mean(historicalVolumeValues)                                // 历史均量均值
volumeRatio = currentVolume / meanVolume                                 // 量比
volumeSkew = currentUpVolumeAvg / currentDownVolumeAvg                   // 量偏度
```

**量比分类阈值**：

| volumeRatio 范围 | 级别 | 含义 |
|-----------------|------|------|
| > 1.5 | 异常放量 | 成交量远超历史均值 |
| 1.2 ~ 1.5 | 显著放量 | 成交量明显偏高 |
| 0.8 ~ 1.2 | 正常 | 成交量接近历史均值 |
| < 0.8 | 缩量 | 成交量低于历史均值 |

**量偏度解读**：
- `volumeSkew > 1.0`：阳线成交量 > 阴线成交量，买方更积极
- `volumeSkew < 1.0`：阴线成交量 > 阳线成交量，卖方更积极

### 4.6 Layer 6: 量价确认

**综合判断逻辑**：将驱动类型（Layer 4）与成交量状态（Layer 5）交叉验证：

| 驱动类型 | 量比条件 | 量偏度条件 | 确认级别 | 含义 |
|----------|----------|-----------|----------|------|
| 多头进攻型 | > 1.2 | 阳线量 > 阴线量 | 强确认 | 放量上涨，多头有效 |
| 多头进攻型 | < 0.8 | — | 弱确认 | 缩量上涨，警惕假突破 |
| 多头进攻型 | 其他 | — | 正常蓄势 | 量能配合一般 |
| 空头进攻型 | > 1.2 | 阴线量 > 阳线量 | 强确认 | 放量下跌，空头有效 |
| 空头进攻型 | < 0.8 | — | 弱确认 | 缩量下跌，恐慌未完全释放 |
| 空头进攻型 | 其他 | — | 正常蓄势 | 量能配合一般 |
| 波动收缩型 | < 0.8 | — | 正常蓄势 | 缩量盘整，符合预期 |
| 波动收缩型 | ≥ 0.8 | — | 异常放量待变盘 | 收缩期放量，可能突破 |
| 波动放大型 | 任何 | — | 方向不明 | 波动放大但方向不确定 |
| 无明显驱动 | 任何 | — | 正常蓄势 | 无显著信号 |

### 4.7 异常检测

```typescript
isAnomaly = currentSkew > 5 || currentSkew < 0.2
```

偏度比超出 [0.2, 5.0] 范围时标记为异常，附加原因说明："偏度比超出正常范围，可能为数据异常或极端行情，需人工复核"。

---

## 五、历史样本生成策略

历史样本的生成质量直接影响 Layer 1/3/4/5 的计算结果。当前实现包含三条路径：

### 5.1 路径1：历史数据充足（`historicalReturns.length >= window`）

**适用场景**：API返回数据量 > window * 2.5（如 window=60 需要约150条数据）

```typescript
const maxStepSize = Math.max(Math.floor(window / 2), 10);  // 默认步长 = 30
const maxPossibleSamples = Math.floor((historicalReturns.length - window) / maxStepSize) + 1;

// 若样本数不足3个，自动缩小步长
if (maxPossibleSamples < 3) {
  stepSize = Math.max(Math.floor((historicalReturns.length - window) / 2), 1);
}

// 滚动窗口遍历
for (let i = 0; i <= historicalReturns.length - window; i += stepSize) {
  // 每段计算 stdDev 和 meanVolume
}
```

**示例**（window=60，historicalReturns=120）：
- 步长 = 30
- 样本数 = floor((120-60)/30) + 1 = 3
- 采样位置：[0,60], [30,90], [60,120]

### 5.2 路径2：历史数据不足但可用（`historicalReturns.length >= 20`）

**适用场景**：当前最常见的路径（100条数据，historicalReturns ≈ 39~60）

```typescript
const subWindow = Math.max(Math.floor(historicalReturns.length * 0.6), 15);
const subStep = Math.max(Math.floor(subWindow / 2), 5);

// 若样本数不足3个，自动缩小步长
if (maxPossibleSubSamples < 3) {
  subStep = Math.max(Math.floor((historicalReturns.length - subWindow) / 2), 1);
}
```

**示例**（historicalReturns=39）：
- subWindow = max(floor(39×0.6), 15) = 23
- 默认 subStep = max(floor(23/2), 5) = 11
- maxPossibleSubSamples = floor((39-23)/11) + 1 = 2 → 不足3个
- 调整 subStep = max(floor((39-23)/2), 1) = 8
- 最终样本数 = floor((39-23)/8) + 1 = 3
- 采样位置：[0,23], [8,31], [16,39]

**问题**：子窗口大小（23）与期望窗口（60）差距较大，且样本间存在高度重叠，统计独立性较差。

### 5.3 路径3：历史数据极度不足（最终回退）

**适用场景**：historicalReturns < 20

```typescript
const halfWindow = Math.max(Math.floor(window / 2), 10);
// 从当前窗口数据中切分子段作为"历史"参考
for (let i = 0; i <= currentReturns.length - halfWindow; i += halfWindow) {
  // 从当前窗口内部生成参考值
}
```

**问题**：使用当前窗口数据作为"历史"参考，逻辑上存在循环引用，参考基线不可靠。

---

## 六、信号评分系统 — `generateTradingSignal()`

### 6.1 评分规则

| 维度 | 条件 | 分值 | 权重说明 |
|------|------|------|----------|
| 波动率水平 | volRatio < 0.85 | +1 | 极度压缩视为看涨信号 |
| 波动率水平 | volRatio > 1.20 | -1 | 极端放大视为看跌信号 |
| 偏度方向 | currentSkew > 1.0 | +1 | 上行主导偏多 |
| 偏度方向 | currentSkew < 1.0 | -1 | 下行主导偏空 |
| 偏度偏离 | skewDeviation > 0.3 | +1 | 偏度显著偏高偏多 |
| 偏度偏离 | skewDeviation < -0.3 | -1 | 偏度显著偏低偏空 |
| 驱动类型 | 多头进攻型 | +2 | 最高权重因子 |
| 驱动类型 | 空头进攻型 | -2 | 最高权重因子 |
| 多周期一致性 | 完全一致 | +2 | 需多周期分析支持 |
| 多周期一致性 | 严重分歧 | -2 | 需多周期分析支持 |

**理论分值范围**：-5 ~ +5

**实际分值范围**（扫描器模式，未启用多周期）：**-3 ~ +3**

### 6.2 信号映射

| 评分范围 | 信号 | 颜色标识 |
|----------|------|----------|
| ≥ 3 | 强势做多 | 绿色 |
| 1 ~ 2 | 偏多，可持仓 | 浅绿 |
| 0 | 中性，观望 | 灰色 |
| -2 ~ -1 | 偏空，减仓 | 橙色 |
| ≤ -3 | 强势做空 | 红色 |

### 6.3 信号覆盖规则

| 条件 | 覆盖动作 | 原因 |
|------|----------|------|
| 多周期严重分歧 + 强势做多 | 降级为"偏多，可持仓" | 分歧降低信心 |
| 多周期严重分歧 + 强势做空 | 降级为"偏空，减仓" | 分歧降低信心 |
| 偏度比异常（>5 或 <0.2） | 追加警告 | 数据可能异常 |
| 多头进攻型 + 量比<0.8 | 追加"缩量上涨，警惕假突破" | 量能不配合 |
| 空头进攻型 + 量比<0.8 | 追加"缩量下跌，恐慌尚未完全释放" | 量能不配合 |
| 波动收缩型 + 量比>1.3 | 追加"缩量后异常放量，可能即将变盘" | 变盘前兆 |

---

## 七、多周期一致性分析 — `analyzeAllPeriods()`

### 7.1 周期配置

| 周期 | API类型 | 分析窗口 | 标签 |
|------|---------|----------|------|
| 15分钟 | minute15 | 120 | 15分钟 |
| 60分钟 | hour | 60 | 60分钟 |
| 日线 | day | 60 | 日线 |
| 周线 | week | 20 | 周线 |

### 7.2 一致性判定

```typescript
bullishCount = 偏度比 > 1.0 的周期数

if (bullishCount === total)        → 完全一致
else if (bullishCount >= total - 1) → 基本一致
else if (bullishCount >= total / 2) → 中等分歧
else                                → 严重分歧
```

| 周期总数 | bullishCount | 一致性级别 |
|----------|-------------|-----------|
| 4 | 4 | 完全一致 |
| 4 | 3 | 基本一致 |
| 4 | 2 | 中等分歧 |
| 4 | 0~1 | 严重分歧 |

### 7.3 当前使用状态

⚠️ **扫描器页面未启用多周期分析**。`scanSingle()` 仅调用日线数据：

```typescript
const result = await getKlineData(target.code, 'day');  // 仅日线
const analysis = analyzeVolatilitySkew(stockData, window, 0.05);
```

多周期分析仅在 `App.tsx` 的单股详情页中通过 `analyzeAllPeriods()` 启用。因此：
- 扫描器中 `periodConsistency` 始终为 `undefined`
- 评分中多周期维度（±2分）永远不生效
- 实际评分范围被压缩至 **-3 ~ +3**
- 信号覆盖中的"多周期严重分歧降级"规则也不会触发

---

## 八、扫描器页面交互逻辑

### 8.1 扫描范围

| 范围 | 数据来源 | 说明 |
|------|----------|------|
| 自选股 | `localStorage.getItem('watchlist')` | 用户真实自选股数据 |
| 板块指数 | `LOCAL_INDEX_LIST` | 指数管理配置中的全部指数 |
| 主要指数 | `LOCAL_INDEX_LIST` 过滤 `sh000*` / `sz399*` | 仅沪深主要指数 |

### 8.2 可调参数

| 参数 | 默认值 | 范围 | 说明 |
|------|--------|------|------|
| 窗口 | 60 | 10~120 | 分析窗口大小（实际受自适应机制约束） |
| 数量 | 10 | 3~20 | 扫描目标数量 |

### 8.3 排序与过滤

**排序维度**：

| 维度 | 排序依据 |
|------|----------|
| 评分 | `signalResult.score` 降序 |
| 偏度 | `analysis.currentSkew` 降序 |
| 量比 | `analysis.volRatio` 降序 |

**过滤条件**：

| 过滤器 | 条件 |
|--------|------|
| 全部 | 无过滤 |
| 偏多 | `score > 0` |
| 中性 | `score === 0` |
| 偏空 | `score < 0` |

### 8.4 扫描执行流程

```
1. 用户点击"开始扫描"
2. 重置所有结果状态为 pending
3. 逐个遍历 targets：
   a. 设置状态为 loading
   b. 调用 scanSingle() 获取数据
   c. 更新状态为 done 或 error
   d. 更新进度百分比
4. 扫描完成，isScanning = false
```

**注意**：扫描是**串行执行**的，每个目标依次请求API，未做并发控制。

---

## 九、当前已知问题与风险

### 9.1 数据质量问题

| 问题 | 严重程度 | 影响 | 状态 |
|------|----------|------|------|
| `analyzeVolatilitySkew()` 未过滤 close≤0 异常数据 | 高 | 可能产生 NaN，导致分析结果不可用 | 未修复 |
| API返回数据量有限（~100条） | 中 | effectiveWindow 被压缩，分析精度受限 | 已通过自适应窗口缓解 |
| 新浪API对部分板块指数返回数据不完整 | 中 | 部分指数无法分析 | 无法控制 |

### 9.2 计算逻辑问题

| 问题 | 严重程度 | 影响 | 状态 |
|------|----------|------|------|
| 历史样本量少（仅3个）且高度重叠 | 高 | 统计基线不可靠，upVolDeviation/downVolDeviation 易落入死区 | 已通过子窗口回退缓解 |
| 死区阈值固定为5% | 中 | 在样本量少时，5%死区过于宽松，大量标的被判为"无明显驱动特征" | 未调整 |
| 路径3使用当前窗口数据作为历史参考 | 中 | 循环引用，参考基线不可靠 | 未修复 |

### 9.3 功能缺失

| 问题 | 严重程度 | 影响 | 状态 |
|------|----------|------|------|
| 扫描器未启用多周期分析 | 高 | 评分范围被压缩至-3~+3，无法达到"强势做多/做空" | 未实现 |
| 扫描串行执行 | 低 | 大量目标时扫描速度慢 | 未优化 |
| 无缓存机制 | 低 | 重复扫描同一标的需重新请求API | 未实现 |

### 9.4 "无明显驱动特征"占比过高的根因分析

在实际使用中，绝大多数扫描结果为"无明显驱动特征"，量比为1.00。根因链路如下：

```
API返回~100条数据
  → returns = 99条
  → effectiveWindow = min(60, max(39, 20)) = 39
  → historicalReturns = 99 - 39 = 60条
  → historicalReturns.length(60) >= window(60)，走路径1
  → 但 maxStepSize = 30，maxPossibleSamples = floor((60-60)/30)+1 = 1
  → 不足3个样本，步长缩小为 floor((60-60)/2) = 0 → max(0,1) = 1
  → 样本数 = floor((60-60)/1)+1 = 1
  → 实际只有1个历史样本！
  → meanUpVol ≈ 那唯一一个样本的upVol
  → upVolDeviation = (currentUpVol - meanUpVol) / meanUpVol
  → 由于只有1个参考点，偏离度容易落在±5%死区内
  → 驱动类型 = "无明显驱动特征"
```

**关键发现**：即使 `historicalReturns.length >= window`，当两者相等时（如都是60），路径1也只能生成1个样本。需要 `historicalReturns.length > window + 2 * maxStepSize` 才能生成3个以上样本，即至少需要 60 + 60 = 120条历史数据，加上当前窗口39条，总共需要约160条数据——远超API返回的100条。

---

## 十、参数汇总表

### 10.1 硬编码参数

| 参数 | 值 | 位置 | 说明 |
|------|------|------|------|
| deadZone | 0.05 | `analyzeVolatilitySkew()` | 驱动类型判定死区 |
| minHistSamples | 3 | `analyzeVolatilitySkew()` | 最少历史样本数 |
| maxStepSize | max(floor(window/2), 10) | `analyzeVolatilitySkew()` | 最大滚动步长 |
| subWindow比例 | 0.6 | `analyzeVolatilitySkew()` | 子窗口占历史数据比例 |
| 异常偏度比上限 | 5.0 | `analyzeVolatilitySkew()` | 偏度比异常判定 |
| 异常偏度比下限 | 0.2 | `analyzeVolatilitySkew()` | 偏度比异常判定 |
| volRatio极度压缩阈值 | 0.80 | `analyzeVolatilitySkew()` | 波动率水平分类 |
| volRatio低于均值阈值 | 0.95 | `analyzeVolatilitySkew()` | 波动率水平分类 |
| volRatio偏高阈值 | 1.05 | `analyzeVolatilitySkew()` | 波动率水平分类 |
| volRatio极端放大阈值 | 1.20 | `analyzeVolatilitySkew()` | 波动率水平分类 |
| skewDeviation显著阈值 | ±0.20 | `analyzeVolatilitySkew()` | 偏度偏离度分类 |
| skewDeviation极度阈值 | ±0.50 | `analyzeVolatilitySkew()` | 偏度偏离度分类 |
| volumeRatio异常放量阈值 | 1.5 | `analyzeVolatilitySkew()` | 成交量分类 |
| volumeRatio显著放量阈值 | 1.2 | `analyzeVolatilitySkew()` | 成交量分类 |
| volumeRatio缩量阈值 | 0.8 | `analyzeVolatilitySkew()` | 成交量分类 |
| score波动率压缩加分 | +1 (volRatio<0.85) | `generateTradingSignal()` | 评分规则 |
| score波动率放大减分 | -1 (volRatio>1.20) | `generateTradingSignal()` | 评分规则 |
| score偏度方向分 | ±1 | `generateTradingSignal()` | 评分规则 |
| score偏度偏离分 | ±1 (skewDeviation>0.3) | `generateTradingSignal()` | 评分规则 |
| score驱动类型分 | ±2 | `generateTradingSignal()` | 评分规则 |
| score多周期一致性分 | ±2 | `generateTradingSignal()` | 评分规则 |

### 10.2 用户可调参数

| 参数 | 默认值 | 范围 | UI位置 |
|------|--------|------|--------|
| window | 60 | 10~120 | 扫描器顶部"窗口"输入框 |
| scanCount | 10 | 3~20 | 扫描器顶部"数量"输入框 |
| scope | watchlist | watchlist/sector/index | 扫描器顶部Tab切换 |
| sortBy | score | score/skew/volRatio | 结果区排序按钮 |
| filter | all | all/bullish/neutral/bearish | 结果区过滤按钮 |

---

## 十一、改进建议

### 11.1 紧急修复

1. **在 `analyzeVolatilitySkew()` 中添加异常数据过滤**：与 `calculateVolatility()` 保持一致，过滤 close ≤ 0 的数据
2. **在扫描器中启用多周期分析**：调用 `analyzeAllPeriods()` 替代单周期分析，使评分范围恢复至 -5 ~ +5

### 11.2 计算优化

3. **调整历史样本生成策略**：当 historicalReturns.length 接近 window 时，当前只能生成1个样本，建议使用更小的子窗口（如 window * 0.5）来增加样本量
4. **动态死区机制**：根据历史样本量调整死区宽度，样本量少时缩小死区（如3个样本时用3%），样本量充足时保持5%
5. **增加API数据获取量**：通过 `kline-history` 接口获取更多历史数据（如200~300条），从根本上解决数据不足问题

### 11.3 功能增强

6. **扫描并发控制**：使用 Promise.all + 限制并发数（如5个），提升扫描速度
7. **结果缓存**：对已扫描的结果进行短期缓存（如5分钟），避免重复请求
8. **信号回测**：记录历史信号与后续走势的对应关系，验证信号有效性
