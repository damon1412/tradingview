# 股票成交量分析工具 (TradeView)

基于 React 18 + TypeScript 的股票成交量分析工具，提供交互式K线图、逐笔交易走势分析和成交量分布研究。

## 核心功能

- **交互式K线图**：支持拖拽框选时间区间，Ctrl+拖动缩放，双击重置
- **逐笔交易分析**：实时逐笔价格走势图，累计买入/卖出线，买卖加速度指标
- **成交量分析**：成交量分布、控制点(POC)、价值区域(VAH/VAL)计算
- **交易统计面板**：关键交易指标展示
- **多周期支持**：分时、1分钟、5分钟、10分钟、30分钟、60分钟、日线、周线
- **固定POC对比**：支持固定多个POC点位进行对比分析
- **深色/浅色主题**：全局主题切换

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（localhost:3266）
npm run dev

# TypeScript 类型检查
npm run typecheck

# 构建生产版本
npm run build
```

## 技术栈

| 分类 | 技术 | 用途 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | 组件化和类型安全 |
| 图表库 | Recharts | K线图、成交量图渲染 |
| 图表库 | Canvas API | 逐笔走势图、技术指标图渲染 |
| 样式 | Tailwind CSS | 响应式UI样式 |
| 构建工具 | Webpack 5 | 开发服务器、模块打包、API代理 |
| 状态管理 | React Hooks | 组件状态管理 |
| 工具库 | date-fns | 日期处理 |
| 图标库 | lucide-react | UI图标 |
| 动画库 | framer-motion | 过渡动画 |

## 项目架构

```
src/
├── components/              # UI组件
│   ├── CandlestickChart.tsx    # K线/蜡烛图组件（Canvas）
│   ├── VolumeChart.tsx         # 成交量柱状图组件（Recharts）
│   ├── VolumeProfile.tsx       # 成交量分布组件（Canvas）
│   ├── IndicatorChart.tsx      # 技术指标图组件（Recharts）
│   ├── TradeTrendChart.tsx     # 逐笔价格走势图（Canvas）
│   ├── TradeIndicatorChart.tsx # 逐笔指标图（累计买卖/加速度，Canvas）
│   ├── TradeAnalysisPanel.tsx  # 逐笔分析主面板
│   ├── StatsPanel.tsx          # 交易统计面板
│   └── TimeFrameSelector.tsx   # 时间周期选择器
├── hooks/                   # 自定义React钩子
│   └── useTheme.ts              # 深色/浅色主题管理
├── services/                # API层
│   └── stockApi.ts              # Supabase + 新浪逐笔数据获取
├── types/                   # TypeScript类型定义
│   └── stock.ts                 # 股票数据、逐笔数据等类型
└── utils/                   # 工具函数
    ├── stockData.ts               # K线数据处理/计算
    ├── indicators.ts              # 技术指标计算（MACD、RSI）
    └── tradeData.ts               # 逐笔数据处理/指标计算
```

## 数据流架构

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│  Supabase   │    │   新浪API    │    │  Webpack   │    │   React      │
│  (K线数据)  │───>│  (逐笔数据)  │───>│  Proxy      │───>│  Components  │
└─────────────┘    └──────────────┘    │  :8080     │    │              │
                                        │  :3266     │    │              │
                                        └────────────┘    └──────────────┘
                                               │                   │
                                        ┌──────┴──────┐     ┌──────┴──────┐
                                        │ stockApi.ts │     │ tradeData.ts│
                                        │ (数据获取)  │     │ (数据处理)  │
                                        └─────────────┘     └─────────────┘
```

## 核心交互

### K线图操作
| 操作 | 效果 |
|------|------|
| 鼠标拖拽 | 框选时间区间，显示筹码分布 |
| Ctrl+拖动 | 缩放K线图 |
| 双击 | 重置缩放和选择 |
| 鼠标悬停 | 显示OHLCV详情 |

### 逐笔分析
| 操作 | 效果 |
|------|------|
| 悬停走势图 | 显示逐笔详情 |
| 切换指标视图 | 累计买卖线 / 买卖加速度 |
| 点击更新按钮 | 刷新最新逐笔数据 |

## 技术指标说明

### 成交量分布指标
- **POC (Point of Control)**：成交量最大的价位
- **VAH (Value Area High)**：70%成交量分布的价值区高点
- **VAL (Value Area Low)**：70%成交量分布的价值区低点

### 逐笔指标
- **累计买入/卖出**：按买卖方向累加成交额
- **买卖加速度**：单位时间内买卖成交额的变化量

## 开发注意事项

- 所有股票相关类型定义在 `types/stock.ts` 中
- 数据转换逻辑在 `utils/stockData.ts` 和 `utils/tradeData.ts` 中
- API调用封装在 `services/stockApi.ts` 中
- 使用Tailwind CSS工具类进行样式开发
