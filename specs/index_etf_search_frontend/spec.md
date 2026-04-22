# tradingview 前端支持指数/ETF搜索方案

## 1. 问题分析

### 当前问题
- `/api/search` 仅返回A股股票，不返回指数和ETF
- 用户在搜索框输入"上证"或"300"时搜不到结果

### 已有资源
- TDX服务已完整支持指数/ETF的K线数据（已验证）
- 代码格式统一：指数 `sh000001`/`sz399001`，ETF `sh510300`/`sz159326`

## 2. 解决方案

### 在 `stockApi.ts` 中添加本地指数/ETF搜索列表

#### 2.1 新增本地列表常量

```typescript
// 在 stockApi.ts 中定义
const LOCAL_INDEX_ETF_LIST: SearchResult[] = [
  // 主要指数
  { code: 'sh000001', name: '上证指数' },
  { code: 'sz399001', name: '深证成指' },
  { code: 'sz399006', name: '创业板指' },
  { code: 'sh000300', name: '沪深300' },
  { code: 'sh000016', name: '上证50' },
  { code: 'sz399005', name: '中小板指' },
  { code: 'sh000905', name: '中证500' },
  { code: 'sh000852', name: '中证1000' },
  { code: 'sz399324', name: '深证红利' },
  { code: 'sh000922', name: '中证红利' },
  
  // 热门ETF
  { code: 'sh510300', name: '沪深300ETF' },
  { code: 'sz159915', name: '创业板ETF' },
  { code: 'sh510050', name: '上证50ETF' },
  { code: 'sz159928', name: '中证消费ETF' },
  { code: 'sh518880', name: '黄金ETF' },
  { code: 'sz159326', name: '机器人ETF' },
  { code: 'sh512480', name: '半导体ETF' },
  { code: 'sz159995', name: '芯片ETF' },
  { code: 'sh512660', name: '军工ETF' },
  { code: 'sz159949', name: '创业板50ETF' },
];
```

#### 2.2 修改搜索函数

```typescript
export async function searchStocks(keyword: string): Promise<{ data: SearchResult[]; error?: ApiError }> {
  const kw = keyword.trim();
  if (!kw) return { data: [] };
  
  // 1. 本地搜索指数/ETF
  const localResults = LOCAL_INDEX_ETF_LIST.filter(
    item => item.code.includes(kw) || item.name.includes(kw)
  );
  
  // 2. 远程搜索A股
  try {
    const response = await fetch(`/api/search?keyword=${encodeURIComponent(kw)}`);
    if (!response.ok) throw response;
    const result = await response.json();
    
    if (result.code === 0 && Array.isArray(result.data)) {
      // 合并结果：本地指数/ETF + A股
      return { data: [...localResults, ...result.data] };
    }
  } catch (error) {
    // 远程搜索失败，只返回本地结果
    return { data: localResults };
  }
  
  // 远程无结果，返回本地结果
  return { data: localResults };
}
```

## 3. 修改范围

| 文件 | 修改内容 |
|------|----------|
| `src/services/stockApi.ts` | 添加本地列表 + 修改 `searchStocks` 函数 |
| 其他文件 | 无需修改 |

## 4. 验证方法

1. 搜索 "上证" → 应返回上证指数
2. 搜索 "300" → 应返回沪深300、沪深300ETF
3. 搜索 "159326" → 应返回机器人ETF
4. 搜索 "平安" → 仍返回平安银行等A股
5. 搜索后点击结果，K线图应正常显示

## 5. 优点

- 无需修改后端服务
- 不影响现有功能
- 列表可灵活扩展
- 搜索速度快（本地过滤）

## 6. 扩展性

如需添加更多指数/ETF，只需在 `LOCAL_INDEX_ETF_LIST` 数组中增加条目即可。
