"""
财务数据 API 路由
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Optional, Any

from ..database.connection import DatabaseManager
from ..services.finance_query import FinanceQueryService

router = APIRouter(prefix="/api/finance", tags=["finance"])

db_manager: Optional[DatabaseManager] = None
query_service: Optional[FinanceQueryService] = None


def init_finance_api(db_path: str):
    """初始化财务API数据库连接"""
    global db_manager, query_service
    db_manager = DatabaseManager(db_path)
    db_manager.initialize()
    query_service = FinanceQueryService(db_manager)


@router.get("/{code}")
async def get_finance_data(
    code: str,
    include_balance: bool = True,
    include_income: bool = True,
    include_cashflow: bool = True
) -> Dict[str, Any]:
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
        metrics = query_service.get_financial_metrics(code)
        if not metrics:
            raise HTTPException(status_code=404, detail=f"未找到股票 {code} 的财务数据")
        
        result: Dict[str, Any] = {
            "code": code,
            "metrics": metrics,
            "latest": metrics[0] if metrics else None
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
async def get_finance_summary(code: str) -> Dict[str, Any]:
    """
    获取财务数据摘要（仅最新一期主要指标）
    """
    if query_service is None:
        raise HTTPException(status_code=500, detail="财务数据服务未初始化")
    
    try:
        summary = query_service.get_finance_summary(code)
        if not summary:
            raise HTTPException(status_code=404, detail=f"未找到股票 {code} 的财务数据")
        
        return summary
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取财务摘要失败: {str(e)}")


@router.post("/fetch/{code}")
async def fetch_and_save_finance(code: str) -> Dict[str, str]:
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
