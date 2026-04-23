# 财务数据集成方案

## 一、现状分析

### 1.1 stock-cli 财务数据库
- **位置**: `stock-cli/src/stock_cli/scripts/finance_fetcher/database/`
- **存储**: SQLite 数据库
- **数据表**:
  - `financial_metrics` - 主要财务指标（PE/eps、PB/bps、ROE等）
  - `balance_sheets` - 资产负债表
  - `income_statements` - 利润表
  - `cashflow_statements` - 现金流量表
  - `stocks` - 股票基本信息

### 1.2 数据获取方式
通过 `stock-cli` 的 API 获取：
- `service.finance(code, count=9)` - 主要财务指标
- `service.balance_sheet(code, count=5)` - 资产负债表
- `service.income_statement(code, count=5)` - 利润表
- `service.cashflow_statement(code, count=5)` - 现金流量表

## 二、独立集成方案

### 2.1 设计原则
- 与 stock-cli 项目相对独立
- 保持清晰的模块边界
- 不破坏现有功能
- 可扩展、易维护

### 2.2 目录结构

```
src/
├── finance/                          # 财务数据模块（新建）
│   ├── database/
│   │   ├── schema.py                 # 数据库表结构定义
│   │   ├── connection.py             # 数据库连接管理
│   │   └── models.py                 # 数据模型定义
│   ├── services/
│   │   ├── finance_fetcher.py        # 财务数据获取服务
│   │   └── finance_query.py          # 财务数据查询服务（新增）
│   ├── api/
│   │   └── routes.py                 # FastAPI 路由（新增）
│   └── utils/
│       └── logger.py                 # 日志工具
```

### 2.3 实现步骤

#### Step 1: 复制数据库文件到独立模块

从 stock-cli 复制以下文件到 `src/finance/database/`:
- `schema.py` - 表结构定义
- `connection.py` - 数据库连接管理
- `models.py` - 数据模型

**修改点**:
- 修改导入路径，使其指向新的模块结构
- 保持数据库路径可配置

#### Step 2: 创建数据查询服务

创建 `src/finance/services/finance_query.py`:

```python
"""
财务数据查询服务

提供财务数据的查询接口，供 API 层调用
"""

from typing import Optional, List, Dict
from datetime import datetime

from ..database.connection import DatabaseManager
from ..database.schema import DatabaseSchema


class FinanceQueryService:
    """财务数据查询服务"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
    
    def get_financial_metrics(
        self, 
        code: str, 
        limit: int = 9
    ) -> List[Dict]:
        """获取主要财务指标"""
        query = """
        SELECT * FROM financial_metrics 
        WHERE code = ?
        ORDER BY report_date DESC
        LIMIT ?
        """
        return self.db.execute_query(query, (code, limit))
    
    def get_latest_metrics(self, code: str) -> Optional[Dict]:
        """获取最新一期财务指标"""
        query = """
        SELECT * FROM financial_metrics
        WHERE code = ?
        ORDER BY report_date DESC
        LIMIT 1
        """
        results = self.db.execute_query(query, (code,))
        return results[0] if results else None
    
    def get_balance_sheets(
        self, 
        code: str, 
        limit: int = 5
    ) -> List[Dict]:
        """获取资产负债表数据"""
        query = """
        SELECT * FROM balance_sheets
        WHERE code = ?
        ORDER BY report_date DESC
        LIMIT ?
        """
        return self.db.execute_query(query, (code, limit))
    
    def get_income_statements(
        self, 
        code: str, 
        limit: int = 5
    ) -> List[Dict]:
        """获取利润表数据"""
        query = """
        SELECT * FROM income_statements
        WHERE code = ?
        ORDER BY report_date DESC
        LIMIT ?
        """
        return self.db.execute_query(query, (code, limit))
    
    def get_cashflow_statements(
        self, 
        code: str, 
        limit: int = 5
    ) -> List[Dict]:
        """获取现金流量表数据"""
        query = """
        SELECT * FROM cashflow_statements
        WHERE code = ?
        ORDER BY report_date DESC
        LIMIT ?
        """
        return self.db.execute_query(query, (code, limit))
    
    def get_full_finance_data(self, code: str) -> Dict:
        """获取某股票的完整财务数据"""
        return {
            "metrics": self.get_financial_metrics(code),
            "latest": self.get_latest_metrics(code),
            "balance_sheets": self.get_balance_sheets(code),
            "income_statements": self.get_income_statements(code),
            "cashflow_statements": self.get_cashflow_statements(code),
        }
```

#### Step 3: 创建 API 路由

创建 `src/finance/api/routes.py` (使用 FastAPI):

```python
"""
财务数据 API 路由
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Optional

from ..database.connection import DatabaseManager
from ..services.finance_query import FinanceQueryService

router = APIRouter(prefix="/api/finance", tags=["finance"])

# 数据库管理器（应用启动时初始化）
db_manager: Optional[DatabaseManager] = None
query_service: Optional[FinanceQueryService] = None


def init_finance_api(db_path: str):
    """初始化财务API数据库连接"""
    global db_manager, query_service
    db_manager = DatabaseManager(db_path)
    query_service = FinanceQueryService(db_manager)


@router.get("/{code}")
async def get_finance_data(
    code: str,
    include_balance: bool = True,
    include_income: bool = True,
    include_cashflow: bool = True
) -> Dict:
    """
    获取某股票的财务数据
    
    - **code**: 股票代码
    - **include_balance**: 是否包含资产负债表
    - **include_income**: 是否包含利润表
    - **include_cashflow**: 是否包含现金流量表
    """
    if query_service is None:
        raise HTTPException(status_code=500, detail="财务数据服务未初始化")
    
    try:
        data = query_service.get_financial_metrics(code)
        if not data:
            raise HTTPException(status_code=404, detail=f"未找到股票 {code} 的财务数据")
        
        result = {
            "code": code,
            "metrics": data,
            "latest": data[0] if data else None
        }
        
        if include_balance:
            result["balance_sheets"] = query_service.get_balance_sheets(code)
        
        if include_income:
            result["income_statements"] = query_service.get_income_statements(code)
        
        if include_cashflow:
            result["cashflow_statements"] = query_service.get_cashflow_statements(code)
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取财务数据失败: {str(e)}")


@router.get("/{code}/summary")
async def get_finance_summary(code: str) -> Dict:
    """
    获取财务数据摘要（仅最新一期主要指标）
    """
    if query_service is None:
        raise HTTPException(status_code=500, detail="财务数据服务未初始化")
    
    try:
        latest = query_service.get_latest_metrics(code)
        if not latest:
            raise HTTPException(status_code=404, detail=f"未找到股票 {code} 的财务数据")
        
        return {
            "code": code,
            "report_date": latest.get("report_date"),
            "eps": latest.get("eps"),
            "bps": latest.get("bps"),
            "revenue": latest.get("revenue"),
            "net_profit": latest.get("net_profit"),
            "roe": latest.get("roe"),
            "roa": latest.get("roa"),
            "debt_ratio": latest.get("debt_ratio"),
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取财务摘要失败: {str(e)}")


@router.post("/fetch/{code}")
async def fetch_and_save_finance(code: str) -> Dict:
    """
    从数据源获取并保存某股票的财务数据
    """
    if query_service is None:
        raise HTTPException(status_code=500, detail="财务数据服务未初始化")
    
    try:
        from ..services.finance_fetcher import FinanceFetcherService
        from ..utils.time_utils import RateLimiter
        
        rate_limiter = RateLimiter(min_interval=1.0)
        fetcher = FinanceFetcherService(db_manager, rate_limiter)
        success, message = fetcher.fetch_and_save(code)
        
        if success:
            return {"status": "success", "message": message}
        else:
            raise HTTPException(status_code=500, detail=f"获取失败: {message}")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取并保存失败: {str(e)}")
```

#### Step 4: 主程序入口

创建 `src/finance/main.py`:

```python
"""
财务数据模块主入口

用于初始化数据库连接和启动API服务
"""

import os
from typing import Optional

from .database.connection import DatabaseManager
from .database.schema import DatabaseSchema
from .api.routes import init_finance_api, router

# 默认数据库路径
DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "finance.db")

# 全局数据库管理器
db_manager: Optional[DatabaseManager] = None


def initialize(db_path: str = DEFAULT_DB_PATH):
    """初始化财务数据模块"""
    global db_manager
    
    # 确保数据库目录存在
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    # 初始化数据库连接
    db_manager = DatabaseManager(db_path)
    
    # 创建表
    for table_sql in DatabaseSchema.ALL_TABLES:
        db_manager.execute(table_sql)
    
    # 创建索引
    for index_sql in DatabaseSchema.CREATE_INDEXES:
        db_manager.execute(index_sql)
    
    db_manager.commit()
    
    # 初始化API
    init_finance_api(db_path)
    
    return router


def get_db_manager() -> DatabaseManager:
    """获取数据库管理器实例"""
    if db_manager is None:
        raise RuntimeError("财务数据模块未初始化，请先调用 initialize()")
    return db_manager
```

#### Step 5: 复制采集器代码

从 stock-cli 复制以下文件到 `src/finance/services/`:
- `finance_fetcher.py` - 数据采集器

**修改点**:
- 修改导入路径，使其指向新的模块结构
- 保持数据获取逻辑不变

#### Step 6: 集成到现有后端

修改现有的后端服务（如 `src/services/stockApi.ts` 对应的后端），添加财务数据路由:

```python
# 在 FastAPI 主应用中
from fastapi import FastAPI
from finance.main import initialize

app = FastAPI()

# 初始化财务数据模块并注册路由
finance_router = initialize()
app.include_router(finance_router)
```

#### Step 7: 前端集成

创建前端财务数据面板组件 `src/components/FinancePanel.tsx`:

```typescript
import React, { useEffect, useState } from 'react';

interface FinanceMetrics {
  code: string;
  report_date: string;
  eps: number;
  bps: number;
  revenue: number;
  net_profit: number;
  roe: number;
  roa: number;
  debt_ratio: number;
}

interface FinancePanelProps {
  stockCode: string;
}

export const FinancePanel: React.FC<FinancePanelProps> = ({ stockCode }) => {
  const [data, setData] = useState<FinanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFinanceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/finance/${stockCode}/summary`);
        if (!response.ok) {
          throw new Error('获取财务数据失败');
        }
        const result = await response.json();
        setData(result);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFinanceData();
  }, [stockCode]);

  if (loading) return <div className="p-4 text-center text-slate-500">加载财务数据...</div>;
  if (error) return <div className="p-4 text-center text-red-400">{error}</div>;
  if (!data) return <div className="p-4 text-center text-slate-500">暂无财务数据</div>;

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-slate-200 font-semibold text-sm mb-3">基本面数据</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400">报告期</div>
          <div className="text-sm text-slate-200">{data.report_date}</div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400">每股收益 (EPS)</div>
          <div className="text-sm text-slate-200">{data.eps?.toFixed(2) ?? '-'}</div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400">每股净资产 (BPS)</div>
          <div className="text-sm text-slate-200">{data.bps?.toFixed(2) ?? '-'}</div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400">净资产收益率 (ROE)</div>
          <div className="text-sm text-slate-200">{data.roe ? `${data.roe.toFixed(2)}%` : '-'}</div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400">资产负债率</div>
          <div className="text-sm text-slate-200">{data.debt_ratio ? `${data.debt_ratio.toFixed(2)}%` : '-'}</div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400">总资产收益率 (ROA)</div>
          <div className="text-sm text-slate-200">{data.roa ? `${data.roa.toFixed(2)}%` : '-'}</div>
        </div>
      </div>
    </div>
  );
};
```

## 三、数据库更新方法

### 3.1 手动更新

```bash
# 更新单个股票
curl -X POST http://localhost:3000/api/finance/fetch/600519

# 批量更新（需要写批量脚本）
```

### 3.2 定时任务

使用 cron 或 APScheduler 定期更新:

```python
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

@scheduler.scheduled_job('cron', hour=2, minute=0)
def update_all_finance_data():
    """每日凌晨2点更新所有股票财务数据"""
    # 获取需要更新的股票列表
    # 循环调用 fetch_and_save
    pass

scheduler.start()
```

### 3.3 命令行工具

创建独立的更新脚本 `update_finance.py`:

```python
#!/usr/bin/env python3
"""
财务数据更新脚本

用法:
    python update_finance.py --code 600519
    python update_finance.py --all
"""

import argparse
from finance.main import initialize
from finance.services.finance_fetcher import FinanceFetcherService

def main():
    parser = argparse.ArgumentParser(description='更新财务数据')
    parser.add_argument('--code', type=str, help='股票代码')
    parser.add_argument('--all', action='store_true', help='更新所有股票')
    args = parser.parse_args()
    
    # 初始化
    initialize()
    
    if args.code:
        fetcher = FinanceFetcherService(db_manager, RateLimiter(min_interval=1.0))
        success, msg = fetcher.fetch_and_save(args.code)
        print(f"{args.code}: {'成功' if success else f'失败 - {msg}'}")
    
    elif args.all:
        # 获取所有股票列表
        # 循环更新
        pass

if __name__ == '__main__':
    main()
```

## 四、数据流

```
stock-cli API → FinanceFetcherService → SQLite数据库
                                              ↓
                                    FinanceQueryService
                                              ↓
                                    FastAPI 路由 (/api/finance)
                                              ↓
                                    前端 FinancePanel 组件
```

## 五、独立运行

### 5.1 作为独立服务运行

```bash
# 启动财务数据服务
uvicorn finance.api.server:app --host 0.0.0.0 --port 8001

# 主应用
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 5.2 作为模块集成到主应用

```python
# 在 FastAPI 主应用中
from finance.main import initialize

app = FastAPI()
finance_router = initialize()
app.include_router(finance_router)
```

## 六、验收标准

- [ ] 数据库独立存在于 `src/finance/database/`
- [ ] 财务数据查询服务正常工作
- [ ] API 端点 `/api/finance/{code}` 返回正确数据
- [ ] 前端 FinancePanel 组件正常展示
- [ ] 与 stock-cli 项目解耦，可独立运行
- [ ] 提供数据更新脚本
