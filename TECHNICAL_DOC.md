# TradeView 技术架构与数据处理文档

## 1. 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        前端 (React 18)                          │
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Webpack    │    │  Components  │    │   Utils          │   │
│  │  Dev Server │◄──►│  (UI/Charts) │◄──►│   (Data Process) │   │
│  │  :3266      │    │              │    │                  │   │
│  └──────┬──────┘    └──────────────┘    └──────────────────┘   │
│         │                                                       │
│         │ API Proxy                                             │
│         ├─ /api/*      → http://localhost:8080                 │
│         └─ /sina-tick/* → https://vip.stock.finance.sina.com.cn │
└─────────┼───────────────────────────────────────────────────────┘
          │
          │
┌─────────┼───────────────────────────────────────────────────────┐
│         │               后端服务                                │
│  ┌──────┴──────┐    ┌──────────────┐                           │
│  │  Supabase   │    │  Backend API │                           │
│  │  (Database) │◄──►│  :8080       │                           │
│  │  (K线/行情) │    │  (数据聚合)   │                           │
│  └─────────────┘    └──────────────┘                           │
└──────────────────────────────────────────────────────────────────┘
```

## 2. 数据源详细说明

### 2.1 Supabase 后端 API (`http://localhost:8080`)

| 接口路径 | 用途 | 请求参数 | 响应数据 |
|---------|------|---------|---------|
| `/api/search` | 股票搜索 | `keyword` | 股票列表 (code, name) |
| `/api/kline` | K线数据 | `code`, `type` | OHLCV 数据，价格单位为 **milli-units** |
| `/api/quote` | 实时行情 | `code` | 最新价、开高低收、昨收价 (milli-units) |
| `/api/minute` | 分时走势 | `code`, `date` | 分时数据点 (时间, 价格, 成交量) |
| `/api/kline-history` | 历史K线 | `code`, `type`, `start_date`, `end_date`, `limit` | 指定时间范围的K线数据 |
| `/api/minute-trade-all` | 历史逐笔 | `code`, `date` | 单日逐笔成交数据 |

### 2.2 新浪财经 API (通过 webpack 代理)

| 代理路径 | 实际URL | 用途 |
|---------|---------|------|
| `/sina-tick` | `https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_Bill.GetBillList` | 当日逐笔成交数据 |

**新浪逐笔数据响应格式：**
```json
[
  {
    "ticktime": "14:57:24",
    "price": "11.09",
    "volume": "28800",
    "volume_hand": "288",
    "kind": "U",
    "prev_price": "11.11"
  }
]
```

**`kind` 字段含义：**
- `U` = 买入 (主动买入/外盘)
- `D` = 卖出 (主动卖出/内盘)
- `E` = 中性 (撮合成交)

**数据特性：**
- 3秒级别聚合数据（非逐笔撮合）
- 最多返回1000条
- 最小成交额约20万元
- 仅支持当日数据

### 2.3 时间周期映射

| 前端 TimeFrame | 后端 API type | 说明 |
|---------------|---------------|------|
| `minute` | `minute1` | 1分钟K线 |
| `1m` | `minute1` | 1分钟K线 |
| `5m` | `minute5` | 5分钟K线 |
| `10m` | `minute5` | 10分钟K线 (复用5分钟) |
| `30m` | `minute30` | 30分钟K线 |
| `60m` | `hour` | 60分钟K线 |
| `1d` | `day` | 日线K线 |
| `1w` | `week` | 周线K线 |

## 3. 数据类型定义

### 3.1 核心数据类型 (`types/stock.ts`)

```typescript
// K线数据 (OHLCV)
interface StockData {
  timestamp: number;   // 毫秒时间戳
  open: number;        // 开盘价 (yuan)
  high: number;        // 最高价 (yuan)
  low: number;         // 最低价 (yuan)
  close: number;       // 收盘价 (yuan)
  volume: number;      // 成交量 (股)
}

// 成交量分布
interface VolumeProfile {
  price: number;       // 价位 (yuan)
  volume: number;      // 该价位成交量 (股)
}

// 成交量分布统计
interface VolumeProfileStats {
  poc: number;         // Point of Control - 最大成交量价位 (yuan)
  vah: number;         // Value Area High - 70%价值区上界 (yuan)
  val: number;         // Value Area Low - 70%价值区下界 (yuan)
  totalVolume: number; // 总成交量 (股)
}

// 选中区间
interface SelectedRange {
  startIndex: number;  // 起始索引
  endIndex: number;    // 结束索引
}

// 固定POC
interface PinnedProfile {
  id: string;                  // 唯一标识
  range: SelectedRange;        // 区间范围
  stats: VolumeProfileStats;   // 分布统计
  color: string;               // 显示颜色
}

// 逐笔成交
interface TradeTick {
  time: string;        // 时间字符串 "14:57"
  timestamp: number;   // 毫秒时间戳
  price: number;       // 成交价 (yuan)
  volume: number;      // 成交量 (股)
  amount: number;      // 成交额 (yuan)
  status: 0 | 1 | 2;   // 0=中性, 1=买入, 2=卖出
}

// 逐笔指标数据
interface TradeIndicatorData {
  prices: number[];           // 价格序列
  timestamps: number[];       // 时间序列
  cumulativeBuy: number[];    // 累计买入 (yuan)
  cumulativeSell: number[];   // 累计卖出 (yuan)
  buyAcceleration: number[];  // 买入加速度 (yuan)
  sellAcceleration: number[]; // 卖出加速度 (yuan)
}
```

## 4. 数据处理与单位转换

### 4.1 K线数据转换 (`convertKlineToStockData`)

```
后端API响应          →     前端存储        →     组件使用
─────────────────────────────────────────────────────
Open/High/Low/Close:      open/high/low/close:
  milli-units               yuan (÷1000)
  
  11090                    11.09

Volume:                   volume:
  shares                  shares (无转换)
  
  28800                   28800
```

**代码实现：**
```typescript
// stockApi.ts
open: item.Open / 1000,      // milli-units → yuan
high: item.High / 1000,
low: item.Low / 1000,
close: item.Close / 1000,
volume: item.Volume          // shares, 无转换
```

### 4.2 新浪逐笔数据转换

```
Sina API响应         →     TradeTickData    →     TradeTick        →     显示
───────────────────────────────────────────────────────────────────────────
price: "11.09"       →     Price: 11090     →     price: 11.09
(yuan, string)             (milli-units)           (yuan)

volume: "28800"      →     Volume: 28800    →     volume: 28800
(shares, string)           (shares)                (shares)

kind: "U"            →     Status: 1        →     status: 1
(B=买入,D=卖出,E=中性)                           (0=中性,1=买入,2=卖出)

ticktime: "14:57:24" →     Time: "14:57:24" →     time: "14:57"
(time string)              (time string)            (formatted)
```

**转换流程：**
1. **Sina API → TradeTickData** (`getSinaTickData`):
   ```typescript
   Price: Math.round(parseFloat(item.price) * 1000)  // yuan → milli-units
   Volume: parseInt(item.volume)                      // 无转换
   Status: kind === 'U' ? 1 : kind === 'D' ? 2 : 0   // 买卖方向映射
   ```

2. **TradeTickData → TradeTick** (`convertTradeTickData`):
   ```typescript
   price: item.Price / 1000        // milli-units → yuan
   volume: item.Volume             // 无转换
   amount: price * volume          // 成交额 = 价格 × 股数 (yuan)
   ```

**为什么使用 milli-units 存储？**
- JavaScript 浮点数精度问题：`0.1 + 0.2 = 0.30000000000000004`
- 使用整数存储可以避免精度损失
- 后端API统一使用 milli-units，前端保持一致

### 4.3 成交量单位格式化

```typescript
function formatVolume(volume: number): string {
  if (volume >= 100000000) return (volume / 100000000).toFixed(2) + 'B';  // 亿
  if (volume >= 1000000) return (volume / 1000000).toFixed(2) + 'M';      // 百万
  if (volume >= 1000) return (volume / 1000).toFixed(2) + 'K';            // 千
  return volume.toString();
}
```

### 4.4 成交额单位格式化

```typescript
function formatAmount(amount: number): string {
  if (amount >= 100000000) return (amount / 100000000).toFixed(2) + '亿';  // 1亿 = 100,000,000
  if (amount >= 10000) return (amount / 10000).toFixed(2) + '万';          // 1万 = 10,000
  return amount.toFixed(0);
}
```

## 5. 逐笔指标计算

### 5.1 累计买入/卖出

```typescript
let cumBuy = 0;
let cumSell = 0;

tradeTicks.forEach((tick) => {
  if (tick.status === 1) {
    cumBuy += tick.amount;    // 买入累加
  } else if (tick.status === 2) {
    cumSell += tick.amount;   // 卖出累加
  }
});
```

**原理：** 按买卖方向累加每笔成交的成交额

### 5.2 买卖加速度

```typescript
let prevCumBuy = 0;
let prevCumSell = 0;

tradeTicks.forEach((tick, index) => {
  if (index === 0) {
    buyAcceleration.push(0);
    sellAcceleration.push(0);
  } else {
    buyAcceleration.push(cumBuy - prevCumBuy);    // 当前累计 - 上次累计
    sellAcceleration.push(cumSell - prevCumSell);
  }
  prevCumBuy = cumBuy;
  prevCumSell = cumSell;
});
```

**原理：** 计算每笔间隔内的成交额变化，反映买卖力量的变化速率

### 5.3 买卖方向推断（混合模式）

```typescript
if (status === 0) {  // 中性数据
  if (price > prevPrice) {
    status = 1;  // 价格上涨 → 推断为买入
  } else if (price < prevPrice) {
    status = 2;  // 价格下跌 → 推断为卖出
  }
}
```

**原理：**
- 价格上涨：说明有人主动以更高价格买入（主动买入/外盘）
- 价格下跌：说明有人主动以更低价格卖出（主动卖出/内盘）

## 6. 图表渲染

### 6.1 Canvas vs Recharts

| 图表 | 渲染方式 | 原因 |
|------|---------|------|
| K线图 | Canvas | 高性能，支持大量数据点 |
| 成交量图 | Recharts | 内置交互，开发效率高 |
| 逐笔走势图 | Canvas | 逐点着色，性能要求高 |
| 逐笔指标图 | Canvas | 自定义指标渲染 |

### 6.2 Canvas 坐标系

所有 Canvas 图表使用统一的坐标系转换函数：

```typescript
const indexToX = (index: number) => margin.left + (index / (data.length - 1)) * chartWidth;
const priceToY = (price: number) => margin.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
```

## 7. 数据流完整示例

### 7.1 获取并显示逐笔数据

```
1. 用户点击"更新"按钮
   ↓
2. TradeAnalysisPanel 调用 fetchData()
   ↓
3. getSinaTickData("000001") 发送请求
   → /sina-tick?symbol=sz000001&num=1000&sort=ticktime&asc=0&volume=0
   ↓
4. Webpack 代理转发到新浪 API
   → https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_Bill.GetBillList
   ↓
5. 返回原始数据 (price: "11.09", volume: "28800", kind: "U")
   ↓
6. getSinaTickData 转换为 TradeTickData
   → { Price: 11090, Volume: 28800, Status: 1, Time: "14:57:24" }
   → reverse() 转为升序
   ↓
7. convertTradeTickData 转换为 TradeTick
   → { price: 11.09, volume: 28800, amount: 319392, status: 1 }
   ↓
8. calculateTradeIndicators 计算指标
   → cumulativeBuy, cumulativeSell, buyAcceleration, sellAcceleration
   ↓
9. TradeTrendChart + TradeIndicatorChart 渲染
   → Canvas 绘制价格线和指标
```

## 8. 已知问题与限制

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 新浪逐笔数据不平衡 | API端Status字段设计问题 | 使用混合模式推断中性数据 |
| 无历史逐笔数据 | 新浪API仅支持当日 | 需要后端缓存或更换数据源 |
| 小单数据缺失 | 新浪3秒聚合导致最小成交额约20万 | 这是API特性，非代码问题 |
| 分时数据无逐笔精度 | 分时数据为分钟级聚合 | 使用逐笔数据代替 |
