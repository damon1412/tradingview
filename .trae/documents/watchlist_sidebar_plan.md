# 右侧自选股栏方案

## 一、需求分析

### 1.1 功能目标
在应用右侧添加一个可收缩/展开的自选股面板，用户可以：
- 添加自选股或指数（通过搜索或从当前查看的股票添加）
- 删除自选股
- 点击自选股快速切换查看
- 面板可收缩隐藏，节省空间

### 1.2 现有代码基础
- `App.tsx` 已有搜索功能（`useSearch` hook）
- `src/hooks/useStockData.ts` 管理股票数据加载
- `StatsPanel` 组件已占据右侧栏位置
- 已有 `types/stock.ts` 类型定义

## 二、技术方案

### 2.1 数据结构设计

**新增类型** (`types/stock.ts`):
```typescript
export interface WatchlistItem {
  code: string;
  name: string;
  addedAt: number; // 添加时间戳
}
```

**状态管理** (在 `App.tsx` 中):
```typescript
const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
const [showWatchlist, setShowWatchlist] = useState(true); // 面板展开状态
const [showAddWatchlist, setShowAddWatchlist] = useState(false); // 添加面板
```

### 2.2 新增组件

#### 2.2.1 `WatchlistPanel.tsx` - 自选股面板
**位置**: `src/components/WatchlistPanel.tsx`

**功能**:
- 显示自选股列表
- 每个条目显示：代码、名称、最新价（可选）、涨跌幅（可选）
- 点击条目切换股票
- 每个条目有删除按钮
- 顶部有"添加"按钮
- 空状态提示

**Props**:
```typescript
interface WatchlistPanelProps {
  items: WatchlistItem[];
  currentCode: string;
  onAdd: () => void;
  onSelect: (code: string, name: string) => void;
  onRemove: (code: string) => void;
  onClose: () => void;
}
```

#### 2.2.2 `AddWatchlistModal.tsx` - 添加自选股弹窗
**位置**: `src/components/AddWatchlistModal.tsx`

**功能**:
- 集成搜索功能
- 显示搜索结果
- 点击添加
- 已添加的股票显示标记
- 可关闭

**Props**:
```typescript
interface AddWatchlistModalProps {
  existingCodes: string[];
  onAdd: (code: string, name: string) => void;
  onClose: () => void;
}
```

### 2.3 布局设计

```
┌─────────────────────────────────────────────────────────┐
│ Header (搜索 + 时间框架选择)                             │
├─────────────────────────────────────┬───────────────────┤
│                                     │ ┌───────────────┐ │
│                                     │ │ 自选股面板     │ │
│     主图表区域                       │ │ [展开/收起]   │ │
│     (K线图 + 成交量)                 │ │               │ │
│                                     │ │ - 股票1       │ │
│                                     │ │ - 股票2       │ │
│     指标图表                         │ │ - 股票3       │ │
│                                     │ │               │ │
│                                     │ │ [+ 添加]      │ │
│                                     │ └───────────────┘ │
└─────────────────────────────────────┴───────────────────┘
```

**收起状态**: 右侧只显示一个窄条按钮（带图标），点击展开

### 2.4 交互流程

#### 2.4.1 添加自选股
1. 用户点击"添加"按钮
2. 弹出搜索框
3. 输入股票代码或名称
4. 从搜索结果中选择
5. 添加到列表（去重）
6. 关闭弹窗

#### 2.4.2 删除自选股
1. 用户点击股票条目的删除图标
2. 从列表中移除
3. 无需确认（简单操作）

#### 2.4.3 切换自选股
1. 用户点击股票条目
2. 调用 `handleSelectStock` 切换
3. 当前查看的股票高亮显示

#### 2.4.4 面板收起/展开
1. 点击面板顶部或侧边的收起按钮
2. 面板滑出视口
3. 右侧显示一个悬浮按钮
4. 点击按钮重新展开

### 2.5 数据持久化（可选，Phase 2）

**方案 1**: LocalStorage
```typescript
// 保存到 localStorage
localStorage.setItem('watchlist', JSON.stringify(watchlist));

// 读取
const saved = localStorage.getItem('watchlist');
if (saved) setWatchlist(JSON.parse(saved));
```

**方案 2**: Supabase（需要用户登录）

**推荐**: Phase 1 先用 LocalStorage，Phase 2 再考虑云端同步

## 三、实现步骤

### Phase 1: 基础功能

#### Step 1: 更新类型定义
**文件**: `src/types/stock.ts`
- 添加 `WatchlistItem` 接口

#### Step 2: 创建 WatchlistPanel 组件
**文件**: `src/components/WatchlistPanel.tsx`
- 列表展示
- 删除功能
- 切换功能
- 收起/展开按钮

#### Step 3: 创建 AddWatchlistModal 组件
**文件**: `src/components/AddWatchlistModal.tsx`
- 搜索集成
- 添加功能
- 去重逻辑

#### Step 4: 集成到 App.tsx
**文件**: `src/App.tsx`
- 添加状态管理
- 替换/调整右侧栏布局
- 集成两个新组件
- 添加收缩/展开动画

#### Step 5: 样式优化
- Tailwind CSS 样式
- 过渡动画
- 响应式设计

### Phase 2: 增强功能（可选）
- LocalStorage 持久化
- 实时价格显示
- 涨跌幅颜色标记
- 拖拽排序
- 分组管理

## 四、关键代码示例

### 4.1 WatchlistPanel 组件骨架
```typescript
import React from 'react';
import type { WatchlistItem } from '../types/stock';

interface WatchlistPanelProps {
  items: WatchlistItem[];
  currentCode: string;
  onAdd: () => void;
  onSelect: (code: string, name: string) => void;
  onRemove: (code: string) => void;
  onClose: () => void;
}

export const WatchlistPanel: React.FC<WatchlistPanelProps> = ({
  items,
  currentCode,
  onAdd,
  onSelect,
  onRemove,
  onClose
}) => {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="font-semibold text-slate-200">自选股</h3>
        <div className="flex gap-2">
          <button onClick={onAdd} className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded">
            <i className="fas fa-plus"></i> 添加
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            暂无自选股，点击"添加"开始
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.code}
              onClick={() => onSelect(item.code, item.name)}
              className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                item.code === currentCode ? 'bg-blue-600/20' : 'hover:bg-slate-700'
              }`}
            >
              <div>
                <div className="font-mono text-sm text-blue-400">{item.code}</div>
                <div className="text-xs text-slate-400">{item.name}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.code);
                }}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <i className="fas fa-trash text-xs"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
```

### 4.2 App.tsx 集成示例
```typescript
// 新增状态
const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
const [showWatchlist, setShowWatchlist] = useState(true);

// 添加自选股
const handleAddToWatchlist = (code: string, name: string) => {
  if (!watchlist.find(item => item.code === code)) {
    setWatchlist(prev => [...prev, { code, name, addedAt: Date.now() }]);
  }
};

// 删除自选股
const handleRemoveFromWatchlist = (code: string) => {
  setWatchlist(prev => prev.filter(item => item.code !== code));
};

// 布局调整
<div className={`transition-all duration-300 ${showWatchlist ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
  {/* 主图表区域 */}
</div>

{showWatchlist ? (
  <div className="lg:col-span-1">
    <WatchlistPanel
      items={watchlist}
      currentCode={stockCode}
      onAdd={() => setShowAddWatchlist(true)}
      onSelect={handleSelectStock}
      onRemove={handleRemoveFromWatchlist}
      onClose={() => setShowWatchlist(false)}
    />
  </div>
) : (
  <button
    onClick={() => setShowWatchlist(true)}
    className="fixed right-4 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-full shadow-lg transition-all"
  >
    <i className="fas fa-star"></i>
  </button>
)}
```

## 五、注意事项

### 5.1 性能
- 自选股列表预计 20-50 条，无需虚拟列表
- 搜索使用已有的 `useSearch` hook，带防抖

### 5.2 边界情况
- 重复添加：静默忽略或提示"已存在"
- 空列表：显示友好提示
- 当前股票在列表中：高亮显示

### 5.3 响应式
- 移动端：面板全屏或底部抽屉
- 桌面端：右侧固定宽度面板

### 5.4 与现有功能协调
- 替换或合并现有 `StatsPanel` 位置
- 保持搜索功能复用
- 不破坏现有图表布局

## 六、验收标准

- [ ] 可以添加自选股（搜索 + 添加）
- [ ] 可以删除自选股
- [ ] 点击自选股切换查看
- [ ] 面板可收起/展开
- [ ] 当前股票高亮
- [ ] 重复添加有处理
- [ ] 空状态有提示
- [ ] 移动端适配良好
- [ ] 动画流畅自然
