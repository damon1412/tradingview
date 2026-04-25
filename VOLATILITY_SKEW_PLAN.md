# 波动率偏度分析框架实施计划

## 一、需求概述

基于用户提供的六层波动率偏度分析框架，在当前 TradeView Pro 项目中实现完整的波动率结构分析+成交量确认系统。

### 核心目标
1. 实现波动率水平判断（压缩/正常/放大）
2. 实现偏度方向判断（上行/下行主导）
3. 实现偏度偏离度计算（vs 历史均值）
4. **实现偏度驱动分解（四象限分类 + 死区处理）** - 最核心功能
5. 实现多周期一致性检查（权重提升 + 信号覆盖机制）
6. 实现综合评分与信号输出（无重叠阈值链）
7. **补充成交量维度**（量比 + 量价配合度）

### 关键参数
- **默认均值窗口：60天**（可配置）
- **驱动分类死区：±5%**（可配置）
- **支持多周期**：15m, 60m, daily, weekly

---

## 二、现有代码分析

### 已有的基础设施

| 模块 | 文件 | 已有内容 | 复用情况 |
|------|------|----------|----------|
| 数据类型 | `types/stock.ts` | `StockData`, `VolatilityData`, `volSkew` | ✅ 直接扩展 |
| K线数据获取 | `services/stockApi.ts` | 多周期K线数据（含成交量字段） | ✅ 复用 |
| 可视化 | `components/VolatilityChart.tsx` | 波动率曲线图 | ✅ 扩展展示 |
| 统计面板 | `components/StatsPanel.tsx` | 基础价格/成交量统计 | ✅ 扩展展示 |
| 批量扫描 | `components/SkewScannerPage.tsx` | 偏度比扫描 | ⚠️ 可参考 |

### 与现有 `calculateVolatility` 的关系

现有 `calculateVolatility` 计算的是**价格波动率**（年化标准差），输出格式为每个数据点一个 `upVolatility` 和 `downVolatility`。

本框架需要的是**滚动窗口模式**下的当前窗口 vs 历史均值的对比：
- 当前窗口（最近 N 天）的 upVol / downVol
- 历史窗口（之前数据）的 mean_upVol / mean_downVol
- **不年化**，使用原始标准差

由于计算方式（滚动窗口 vs 全量年化）和接口结构完全不同，**`analyzeVolatilitySkew` 是独立函数，不依赖 `calculateVolatility` 的输出**。它只接收 `StockData[]`，内部自行计算所有需要的指标。两者互不干扰。

### 成交量数据源说明

当前项目的数据管道已提供成交量字段：
- **K线数据**（`StockData.volume`）：来自 Supabase/TDX API，单位为股
- **分时数据**：同样包含成交量字段
- **逐笔数据**：包含逐笔成交量

**结论**：成交量维度可以直接在 Phase 1 实现，无需等待数据管道改造。

### 需要新增的内容

| 层级 | 功能 | 预估复杂度 |
|------|------|------------|
| 第一层 | `volRatio` = current_vol / mean_vol | 低 |
| 第二层 | 偏度方向分类（>1 / <1） | 低 |
| 第三层 | `skewDeviation` = (current - mean) / mean | 低 |
| **第四层** | **偏度驱动分解（四象限 + 死区）** | **中** |
| 第五层 | 多周期一致性（权重提升至±2） | 高 |
| 第六层 | 综合评分 + 信号输出（无重叠阈值） | 中 |
| 成交量 | 量比 + 量价配合度 | 中 |

---

## 三、架构设计

### 3.1 数据流

```
StockData[] (OHLCV)
    ↓
analyzeVolatilitySkew() [新增] ← 独立滚动窗口计算，window=60, deadZone=0.05
    ↓ VolatilitySkewAnalysis
    ↓
generateTradingSignal() [新增] ← 含多周期覆盖机制
    ↓ TradingSignal
    ↓
UI展示 (StatsPanel扩展 / 新增信号卡片)
```

**注意**：不依赖 `calculateVolatility()` 的输出。所有波动率指标在 `analyzeVolatilitySkew` 内部自行计算。

### 3.2 新增类型定义 (`types/stock.ts`)

```typescript
// 波动率水平状态
export type VolatilityLevel = '极度压缩' | '低于均值' | '正常水平' | '偏高' | '极端放大';

// 偏度方向
export type SkewDirection = '上行主导' | '下行主导' | '多空平衡';

// 偏度偏离度状态
export type SkewDeviationLevel = '极度偏高' | '显著偏高' | '正常范围' | '显著偏低' | '极度偏低';

// 偏度驱动类型（四象限 + 无显著驱动）
export type SkewDriverType = '多头进攻型' | '波动放大型' | '波动收缩型' | '空头进攻型' | '无明显驱动特征';

// 多周期一致性
export type PeriodConsistency = '完全一致' | '基本一致' | '中等分歧' | '严重分歧';

// 交易信号
export type TradingSignal = '强势做多' | '偏多，可持仓' | '中性，观望' | '偏空，减仓' | '强势做空';

// 成交量状态
export type VolumeLevel = '异常放量' | '显著放量' | '正常' | '缩量';

// 量价配合确认（完整矩阵）
// 七种场景映射到五个确认类型：多头/空头进攻型的"其他"情况和"无明显驱动特征"都映射为"正常蓄势"
export type VolumeConfirmation = '强确认' | '正常蓄势' | '异常放量待变盘' | '方向不明' | '弱确认';

// 偏度分析结果
export interface VolatilitySkewAnalysis {
  // 第一层：波动率水平
  currentVolatility: number;
  meanVolatility: number;
  volRatio: number;
  volLevel: VolatilityLevel;

  // 第二层：偏度方向
  currentSkew: number;
  skewDirection: SkewDirection;

  // 第三层：偏度偏离度
  meanSkew: number;
  skewDeviation: number; // 百分比
  skewDeviationLevel: SkewDeviationLevel;

  // 第四层：偏度驱动分解
  upVolDeviation: number; // 上行波动率偏离度
  downVolDeviation: number; // 下行波动率偏离度
  driverType: SkewDriverType;

  // 成交量维度
  currentVolume: number;
  meanVolume: number;
  volumeRatio: number;
  volumeLevel: VolumeLevel;
  volumeSkew: number; // 上涨量/下跌量
  volumeConfirmation: VolumeConfirmation;

  // 多周期一致性（可选，需要多周期数据）
  periodConsistency?: PeriodConsistency;
  bullishPeriods?: number;
  totalPeriods?: number;

  // 异常标记
  isAnomaly: boolean; // 偏度比>5或<0.2时标记
  anomalyReason?: string;
}

// 交易信号结果
export interface TradingSignalResult {
  score: number;
  signal: TradingSignal;
  originalSignal?: TradingSignal; // 被多周期覆盖前的原始信号
  coverageReason?: string; // 信号覆盖原因
  analysis: VolatilitySkewAnalysis;
  timestamp: number;
}
```

### 3.3 核心函数设计 (`utils/stockData.ts`)

#### 函数1：`analyzeVolatilitySkew`

```typescript
export function analyzeVolatilitySkew(
  data: StockData[],
  window: number = 60,
  deadZone: number = 0.05
): VolatilitySkewAnalysis | null
```

**职责**：
- 输入：原始K线数据 + 窗口大小 + 死区阈值
- 输出：完整的偏度分析结果
- **不依赖** `calculateVolatility` 的输出，内部自行计算所有指标

**辅助函数**：
```typescript
// 标准差计算（样本标准差，非年化）
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// 平均值计算
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
```

**边界处理**：
```typescript
// 数据不足检查：至少需要 window 的 50%
if (data.length < window * 0.5) {
  return null; // 数据不足，无法可靠分析
}
```

**计算逻辑**：

```
0. 计算日收益率序列
   returns[i] = (data[i].close - data[i-1].close) / data[i-1].close  (i >= 1)
   标记上涨日（returns[i] > 0）和下跌日（returns[i] < 0）

1. 检查数据量：data.length < window * 0.5 → 返回 null

2. 分割当前窗口和历史窗口
   currentReturns = returns.slice(-window)         // 最近 window 个周期
   historicalReturns = returns.slice(0, -window)   // 之前的数据

3. 计算当前窗口指标
   currentUpReturns   = currentReturns.filter(r => r > 0)
   currentDownReturns = currentReturns.filter(r => r < 0)
   currentUpVol       = stdDev(currentUpReturns)    // 非年化
   currentDownVol     = stdDev(currentDownReturns)   // 非年化
   currentVol         = stdDev(currentReturns)       // 综合波动率
   currentSkew        = currentDownVol > 0 ? currentUpVol / currentDownVol : 1

   currentVolume      = 当前窗口平均成交量
   currentUpVolumeAvg = 当前窗口上涨日平均成交量
   currentDownVolumeAvg = 当前窗口下跌日平均成交量

4. 计算历史均值指标（从 historicalReturns 滚动计算）
   // 将 historicalReturns 按 window 大小滚动，每个窗口计算 upVol/downVol，然后取平均
   historicalUpVolValues   = []
   historicalDownVolValues = []
   historicalVolValues     = []
   for each window-sized chunk in historicalReturns:
     upReturns = chunk.filter(r => r > 0)
     downReturns = chunk.filter(r => r < 0)
     historicalUpVolValues.push(stdDev(upReturns))
     historicalDownVolValues.push(stdDev(downReturns))
     historicalVolValues.push(stdDev(chunk))

   meanUpVol   = mean(historicalUpVolValues)
   meanDownVol = mean(historicalDownVolValues)
   meanVol     = mean(historicalVolValues)
   meanSkew    = meanDownVol > 0 ? meanUpVol / meanDownVol : 1

   // 历史成交量均值
   meanVolume = historicalChunks 的平均成交量

5. 除零保护（计算 deviation 前）
   meanUpVol   = Math.max(meanUpVol, 0.001)
   meanDownVol = Math.max(meanDownVol, 0.001)
   meanVol     = Math.max(meanVol, 0.001)
   meanSkew    = Math.max(meanSkew, 0.001)

6. 计算偏离度
   volRatio      = currentVol / meanVol
   skewDeviation = (currentSkew - meanSkew) / meanSkew
   upDeviation   = (currentUpVol - meanUpVol) / meanUpVol
   downDeviation = (currentDownVol - meanDownVol) / meanDownVol

7. 分类：volLevel, skewDirection, skewDeviationLevel
   volLevel:
     volRatio < 0.80 → '极度压缩'
     volRatio < 0.95 → '低于均值'
     volRatio <= 1.05 → '正常水平'
     volRatio <= 1.20 → '偏高'
     else → '极端放大'

   skewDirection:
     currentSkew > 1.0 → '上行主导'
     currentSkew < 1.0 → '下行主导'
     else → '多空平衡'

   skewDeviationLevel:
     skewDeviation > +0.50 → '极度偏高'
     skewDeviation > +0.20 → '显著偏高'
     skewDeviation >= -0.20 → '正常范围'
     skewDeviation >= -0.50 → '显著偏低'
     else → '极度偏低'

8. 使用死区判定 driverType：
   if upDev > +deadZone && downDev < -deadZone → 多头进攻型
   if upDev < -deadZone && downDev > +deadZone → 空头进攻型
   if upDev > +deadZone && downDev > +deadZone → 波动放大型
   if upDev < -deadZone && downDev < -deadZone → 波动收缩型
   else → 无明显驱动特征

9. 计算成交量指标
   volumeRatio = currentVolume / meanVolume
   volumeSkew  = currentUpVolumeAvg / Math.max(currentDownVolumeAvg, 0.001)

10. 判定 volumeConfirmation（完整七种场景映射到五个类型）：
    七种场景 → 五种确认类型的映射：
    - 多头进攻型 + 放量+涨量偏多 → '强确认'
    - 多头进攻型 + 缩量 → '弱确认'
    - 多头进攻型 + 其他 → '正常蓄势'
    - 空头进攻型 + 放量+跌量偏多 → '强确认'
    - 空头进攻型 + 缩量 → '弱确认'
    - 空头进攻型 + 其他 → '正常蓄势'
    - 波动收缩型 + 缩量 → '正常蓄势'
    - 波动收缩型 + 放量 → '异常放量待变盘'
    - 波动放大型 → '方向不明'
    - 无明显驱动特征 → '正常蓄势'

11. 极值检查：skew > 5 或 < 0.2 → isAnomaly = true
12. 返回结构化结果
```

#### 函数2：`generateTradingSignal`

```typescript
export function generateTradingSignal(
  analysis: VolatilitySkewAnalysis
): TradingSignalResult
```

**职责**：
- 输入：偏度分析结果
- 输出：综合评分 + 信号（含多周期覆盖机制）

**评分逻辑**（优化后，无重叠阈值）：

```typescript
let score = 0

// 波动率水平
if volRatio < 0.85:  score += 1   // 压缩，变盘临近
if volRatio > 1.20:  score -= 1   // 极端放大，可能见顶

// 偏度方向
if skew > 1.0:       score += 1
if skew < 1.0:       score -= 1

// 偏度偏离
if skewDev > 0.3:    score += 1
if skewDev < -0.3:   score -= 1

// 驱动类型
if driver == '多头进攻型':   score += 2
if driver == '空头进攻型':   score -= 2
// 波动收缩型：+0（中性）
// 无明显驱动特征：+0（中性）

// 多周期一致性（权重提升至±2）
if consistency == '完全一致':  score += 2
if consistency == '严重分歧':  score -= 2

// 信号映射（清晰的 if-else 链，从高到低）
const thresholds: [number, TradingSignal][] = [
  [3,  '强势做多'],
  [1,  '偏多，可持仓'],
  [0,  '中性，观望'],
  [-2, '偏空，减仓'],
  [-3, '强势做空'],
];

let signal = thresholds.find(([min]) => score >= min)?.[1] ?? '中性，观望';

// 【新增】多周期严重分歧时强制降级
if (consistency === '严重分歧') {
  if (signal === '强势做多') {
    originalSignal = signal;
    signal = '偏多，可持仓';
    coverageReason = '多周期严重分歧，降级处理';
  } else if (signal === '强势做空') {
    originalSignal = signal;
    signal = '偏空，减仓';
    coverageReason = '多周期严重分歧，降级处理';
  }
}

// 极值处理：如果 isAnomaly，降低信号置信度但不改变方向
if (isAnomaly) {
  coverageReason = (coverageReason ? coverageReason + '; ' : '') + '偏度比异常值，需人工复核';
}

// 成交量确认（辅助信息，不影响评分）
// 方案A：成交量确认仅作为独立维度展示，不修改score
// 原因：成交量信号噪声较大，直接加入评分可能过度拟合
if (driver == '多头进攻型' && volumeRatio < 0.8) {
  coverageReason = (coverageReason ? coverageReason + '; ' : '') + '缩量上涨，警惕假突破';
}
if (driver == '空头进攻型' && volumeRatio < 0.8) {
  coverageReason = (coverageReason ? coverageReason + '; ' : '') + '缩量下跌，恐慌尚未完全释放';
}
if (driver == '波动收缩型' && volumeRatio > 1.3) {
  coverageReason = (coverageReason ? coverageReason + '; ' : '') + '缩量后异常放量，可能即将变盘';
}

return { score, signal, originalSignal, coverageReason, analysis, timestamp };
```

#### 函数3：`analyzeMultiPeriodConsistency` (Phase 3)

```typescript
export function analyzeMultiPeriodConsistency(
  periodAnalyses: Record<string, VolatilitySkewAnalysis>
): { consistency: PeriodConsistency; bullishCount: number; totalCount: number } | null
```

**职责**：
- 输入：多个周期的偏度分析结果（null 已过滤）
- 输出：一致性判断

**计算逻辑**：
```typescript
// 调用方已过滤 null，这里只处理有效数据
if (Object.keys(periodAnalyses).length === 0) return null;

bullishCount = sum(period.currentSkew > 1.0 for each period)
total = len(periodAnalyses)

if bullishCount == total:     consistency = '完全一致'
elif bullishCount >= total-1: consistency = '基本一致'
elif bullishCount >= total/2: consistency = '中等分歧'
else:                         consistency = '严重分歧'
```

---

## 四、实施阶段

### Phase 1: 类型定义 + 核心计算函数

**目标**：在 `stockData.ts` 实现完整的计算逻辑

**文件变更**：
1. `types/stock.ts` - 新增所有类型定义（含 `isAnomaly`, `originalSignal`, `coverageReason`）
2. `utils/stockData.ts` - 新增 `stdDev` + `mean` 辅助函数 + `analyzeVolatilitySkew` + `generateTradingSignal`
3. `App.tsx`（临时）- 添加手动验证代码，调用新函数并 console.log 输出

**手动验证方案**：
```typescript
// 在开发时临时运行，验证完删除
const testData = generateMockStockData('1d', 120);
const result = analyzeVolatilitySkew(testData, 60, 0.05);
console.log('volLevel:', result?.volLevel);
console.log('driverType:', result?.driverType);
console.log('volumeConfirmation:', result?.volumeConfirmation);

const signal = generateTradingSignal(result!);
console.log('score:', signal.score);
console.log('signal:', signal.signal);
console.log('coverage:', signal.coverageReason);
```

**验证用例（手算对照）**：

| 用例 | 手算预期 | 程序输出 | 一致？ |
|------|----------|----------|--------|
| 电网设备板块 | volRatio=0.93, skew=2.247, 驱动=多头进攻 | | |
| 模拟多头进攻（死区外） | upDev=+0.15, downDev=-0.10 | 驱动=多头进攻型 | |
| 模拟死区内 | upDev=+0.03, downDev=-0.02 | 驱动=无明显驱动特征 | |
| 极值 | skew=6.5 | isAnomaly=true | |
| 信号降级 | score=4 + 严重分歧 | signal=偏多，originalSignal=强势做多 | |

Phase 1 结束时通过以上用例确认计算逻辑正确，无需配置测试框架。

---

### Phase 2: UI 集成 - 信号卡片组件（折叠面板）

**目标**：在 StatsPanel 上方或下方新增独立的折叠面板组件展示分析结果

**文件变更**：
1. 新建 `components/SignalPanel.tsx` - 折叠面板组件（信号始终可见，明细默认折叠）
2. 在 `App.tsx` 中引入并放置在 StatsPanel 上方

**交互设计**：
```
┌─────────────────────────────────┐
│ 信号：偏多，可持仓    评分：+4    │  ← 始终可见
├─────────────────────────────────┤
│ ▶ 展开分析明细                    │  ← 默认折叠
└─────────────────────────────────┘

点击展开后：

┌─────────────────────────────────┐
│ 信号：偏多，可持仓    评分：+4    │
├─────────────────────────────────┤
│ ▼ 分析明细                       │
├─────────────────────────────────┤
│ 波动率  28.62%  低于均值 (0.93)  │
│ 偏度比  2.247   偏离 +58%        │
│ 驱动    多头进攻型               │
│ 量比    1.2     正常             │
│ 量价    强确认                   │
├─────────────────────────────────┤
│ ⚠ 多周期分歧，信号已降级         │
└─────────────────────────────────┘
```

**实现方式**：
```typescript
const [isExpanded, setIsExpanded] = useState(false);

// 信号行始终渲染
<div className="signal-header">
  <SignalBadge signal={result.signal} />
  <ScoreDisplay score={result.score} />
</div>

// 明细行条件渲染
{isExpanded && (
  <div className="analysis-details">
    {/* 6层分析结果 + 警告信息 */}
  </div>
)}
```

**设计理由**：
- 默认折叠解决空间问题，日常使用只看信号和评分
- 展开明细满足深度分析需求，不需要跳转页面
- 独立组件放在 StatsPanel 上方，视觉层级高于统计数据
- 实现复杂度低，一个 `isExpanded` state 即可控制

---

### Phase 3: 多周期一致性分析

**目标**：支持跨周期数据拉取 + 一致性计算

**文件变更**：
1. `services/stockApi.ts` - 新增批量多周期数据获取（串行请求）
2. `utils/stockData.ts` - 新增 `analyzeMultiPeriodConsistency`
3. UI 展示多周期一致性状态

**周期配置表**：
```typescript
const PERIOD_CONFIG = {
  '15m':   { window: 120, label: '15分钟' },  // 约10个交易日
  '60m':   { window: 60,  label: '60分钟' },  // 约15个交易日
  'day':   { window: 60,  label: '日线' },    // 约3个月
  'week':  { window: 20,  label: '周线' },    // 约5个月
} as const;
```

**数据获取策略**（串行请求，避免并发打满后端）：
```typescript
async function analyzeAllPeriods(code: string) {
  const results: Record<string, VolatilitySkewAnalysis> = {};
  
  for (const [period, config] of Object.entries(PERIOD_CONFIG)) {
    const data = await getKlineData(code, period);
    const analysis = analyzeVolatilitySkew(data, config.window);
    if (analysis !== null) {
      results[period] = analysis;
    }
  }
  
  return analyzeMultiPeriodConsistency(results);
}
```

**数据不足处理**：
- 新上市股票可能触发 `data.length < window * 0.5`，`analyzeVolatilitySkew` 返回 null
- `analyzeMultiPeriodConsistency` 自动过滤 null 周期，只统计有效周期

**技术要点**：
- `analyzeVolatilitySkew` 本身不感知周期概念，只接收 `data[]` 和 `window`
- 周期配置是上层决策，核心函数保持纯粹

---

### Phase 4: 可视化增强

**目标**：在 VolatilityChart 中新增信号标记

**文件变更**：
1. `components/VolatilityChart.tsx` - 在图表上标记信号点
2. 可选：新增独立的信号历史走势图

---

## 五、技术要点

### 5.1 均值窗口配置

- **默认值**：60天（日线周期）
- **各周期自适应窗口**：
  - 15分钟：120根（约10个交易日）
  - 60分钟：60根（约15个交易日）
  - 日线：60根（约3个月）
  - 周线：20根（约5个月）
- **实现方式**：通过函数参数传入，周期配置放在调用方，`analyzeVolatilitySkew` 本身不感知周期概念

### 5.2 驱动分类死区

**问题**：偏离度接近 0 时（如 +0.01），归类为"多头进攻型"不合理

**解决方案**：
```typescript
const DEAD_ZONE = 0.05; // 偏离度在 ±5% 以内视为无显著偏离

if (upDev > DEAD_ZONE && downDev < -DEAD_ZONE)  → 多头进攻型
if (upDev < -DEAD_ZONE && downDev > DEAD_ZONE)  → 空头进攻型
if (upDev > DEAD_ZONE && downDev > DEAD_ZONE)   → 波动放大型
if (upDev < -DEAD_ZONE && downDev < -DEAD_ZONE) → 波动收缩型
else → 无明显驱动特征
```

### 5.2.1 数据不足处理

**问题**：当 `data.length < window * 0.5` 时无法可靠计算均值

**解决方案**：直接返回 `null`，调用方处理：
```typescript
if (!analysis) { show '数据不足' }
```
函数不返回带标记的结果，保持接口干净。

### 5.2.2 除零保护

**问题**：当 `mean_up_vol` 或 `mean_down_vol` 接近 0 时，deviation 计算会爆炸

**解决方案**：在步骤 5（计算历史均值后）立即对所有均值做 floor 保护：
```typescript
meanUpVol   = Math.max(meanUpVol, 0.001);
meanDownVol = Math.max(meanDownVol, 0.001);
meanVol     = Math.max(meanVol, 0.001);
meanSkew    = Math.max(meanSkew, 0.001);
```
此后所有用到这些均值的计算（deviation、volRatio、skewDeviation）都不再需要单独处理。

### 5.3 评分阈值链（无重叠）

**问题**：原始 `score >= -2` 区间覆盖了 -1、-2 和 0（已被上一条覆盖）

**解决方案**：
```typescript
const thresholds: [number, TradingSignal][] = [
  [3,  '强势做多'],
  [1,  '偏多，可持仓'],
  [0,  '中性，观望'],
  [-2, '偏空，减仓'],
  [-3, '强势做空'],
];

const signal = thresholds.find(([min]) => score >= min)?.[1] ?? '中性，观望';
```

### 5.4 多周期一致性权重提升

**原因**：多周期分歧是最重要的风险提示，原 ±1 分权重偏低

**新方案**：
1. 权重提升至 ±2 分
2. 严重分歧时强制降级一级信号
3. 记录 `originalSignal` 和 `coverageReason` 供UI展示

```typescript
if (consistency === '严重分歧' && signal === '强势做多') {
  signal = '偏多，可持仓';  // 降一级
  originalSignal = '强势做多';
  coverageReason = '多周期严重分歧，降级处理';
}
```

### 5.5 成交量计算

```typescript
// 量比（当前窗口平均成交量 / 历史窗口平均成交量）
volumeRatio = currentVolume / meanVolume

// 量价偏度（当前窗口上涨日平均成交量 / 下跌日平均成交量）
upDays = currentWindow.filter(d => d.close > d.open)
downDays = currentWindow.filter(d => d.close < d.open)
upVolumeAvg = mean(upDays.map(d => d.volume))
downVolumeAvg = mean(downDays.map(d => d.volume))
volumeSkew = upVolumeAvg / Math.max(downVolumeAvg, 0.001)
```

**说明**：成交量确认仅作为独立维度展示，不参与评分。

### 5.6 极值处理

```typescript
// 偏度比异常值（>5 或 <0.2）
if (skew > 5 || skew < 0.2) {
  isAnomaly = true;
  anomalyReason = '偏度比超出正常范围，可能为数据异常或极端行情，需人工复核';
  // 不改变信号方向，但附加警告信息
}
```

### 5.7 多周期数据获取策略

**策略**：串行请求，避免并发打满后端。3个串行请求耗时约几百毫秒，用户体验无差异。

```typescript
async function analyzeAllPeriods(code: string) {
  const results: Record<string, VolatilitySkewAnalysis> = {};
  
  for (const [period, config] of Object.entries(PERIOD_CONFIG)) {
    const { data: klineData } = await getKlineData(code, period);
    const stockData = convertKlineToStockData(klineData.List);
    const analysis = analyzeVolatilitySkew(stockData, config.window);
    if (analysis !== null) {
      results[period] = analysis;
    }
  }
  
  return analyzeMultiPeriodConsistency(results);
}
```

**null 过滤**：`analyzeMultiPeriodConsistency` 自动跳过返回 null 的周期，只统计有效数据。

### 5.8 计算复杂度

`analyzeVolatilitySkew` 的时间复杂度为 O(n × window)，其中 n 为历史窗口数。对于 window=60、data.length=300 的场景，滚动计算约 4 个窗口，总计约 2400 次收益率运算，前端计算无压力。

---

## 六、测试计划

### 6.1 单元测试（后续补充）

Phase 1 阶段先手动验证，后续配置 vitest/jest 后补写正式测试用例：

| 测试用例 | 输入 | 预期输出 |
|---------|------|----------|
| 波动率压缩 | volRatio=0.80 | volLevel='极度压缩' |
| 偏度上行 | skew=2.247 | direction='上行主导' |
| 偏度偏离 | skewDev=+58% | level='极度偏高' |
| 多头进攻（死区外） | upDev=+0.15, downDev=-0.10 | driver='多头进攻型' |
| 死区内 | upDev=+0.03, downDev=-0.02 | driver='无明显驱动特征' |
| 评分计算 | score=4 | signal='强势做多' |
| 信号降级 | score=4 + consistency='严重分歧' | signal='偏多，可持仓', originalSignal='强势做多' |
| 极值标记 | skew=6.5 | isAnomaly=true |
| 数据不足 | data.length=20, window=60 | return null |
| 除零保护 | meanDownVol=0.0001 | meanDownVol=floor后=0.001 |

### 6.2 集成测试

1. 使用真实股票数据（如平安银行 000001）
2. 验证完整数据流：API → 计算 → 信号输出
3. 对比用户提供的"电网设备板块"验证数据

---

## 七、风险与限制

### 已知限制

1. **本框架只描述波动率结构，不预测价格方向**
   - 偏度比高说明上涨时弹性大，但不代表一定会涨
2. **均值窗口选择影响结果**
   - 60天 vs 20天会得出不同结论，各周期使用自适应窗口
3. **极端值需要人工复核**
   - 偏度比突然飙到 5+ 可能是数据异常
4. **多周期分析增加API压力**
   - 使用串行请求控制并发，新上市股票可能部分周期数据不足

### 性能考虑

- 单次分析计算量：~O(n × window)，window=60、n≈4 时约 2400 次运算
- 多周期分析：4个周期串行请求，前端计算总计约 10000 次运算，无压力
- 批量扫描（如SkewScanner）：需控制并发，避免浏览器卡顿

---

## 八、实施优先级

| 优先级 | 功能 | 原因 |
|--------|------|------|
| **P0** | 核心计算函数 + 类型定义（含死区+无重叠阈值） | 基础，其他功能依赖 |
| **P1** | 信号输出 + StatsPanel展示（含覆盖机制） | 核心用户价值 |
| **P2** | 成交量维度（量比+量价配合） | 增强信号可靠性 |
| **P3** | 多周期一致性（权重±2+降级） | 重要风险提示 |
| **P4** | 可视化增强 | 用户体验优化 |

---

## 九、文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `types/stock.ts` | 新增 | 新增15+类型定义（含 `isAnomaly`, `originalSignal`, `coverageReason`） |
| `utils/stockData.ts` | 新增 | 新增 `stdDev` + `mean` 辅助函数 + `analyzeVolatilitySkew` + `generateTradingSignal` |
| `components/SignalPanel.tsx` | 新增 | 折叠面板组件（Phase 2） |
| `App.tsx` | 修改 | 引入 SignalPanel + 临时手动验证代码（Phase 1） |
| `services/stockApi.ts` | 新增（Phase 3） | 多周期串行数据获取 |
| `components/VolatilityChart.tsx` | 修改（Phase 4） | 信号标记展示 |

---

## 十、验收标准

1. ✅ `analyzeVolatilitySkew` 函数能正确输出六层分析结果
2. ✅ 驱动分类使用死区（±5%），避免偏离度接近0时的误判
3. ✅ 评分阈值无重叠，使用清晰的 if-else 链
4. ✅ 多周期严重分歧时强制降级信号，记录 `originalSignal`
5. ✅ 极值（skew > 5 或 < 0.2）标记 `isAnomaly`，附加警告
6. ✅ `generateTradingSignal` 能输出合理的交易信号
7. ✅ UI 能清晰展示信号 + 分析明细 + 警告信息
8. ✅ 用"电网设备板块"数据验证信号逻辑
9. ✅ 均值窗口可配置（默认60），死区可配置（默认0.05）
10. ✅ 代码符合项目现有规范（TypeScript + Tailwind CSS）
