"""
财务数据查询服务

提供财务数据的查询接口，供 API 层调用
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from ..database.connection import DatabaseManager
from ..database.models import FinancialMetric, BalanceSheet, IncomeStatement, CashflowStatement


class FinanceQueryService:
    """财务数据查询服务"""

    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager

    def get_financial_metrics(
        self,
        code: str,
        limit: int = 9
    ) -> List[Dict[str, Any]]:
        """获取主要财务指标"""
        query = """
        SELECT * FROM financial_metrics
        WHERE code = ?
        ORDER BY report_date DESC
        LIMIT ?
        """
        rows = self.db.fetch_all(query, (code, limit))
        return [dict(row) for row in rows]

    def get_latest_metrics(self, code: str) -> Optional[Dict[str, Any]]:
        """获取最新一期财务指标"""
        query = """
        SELECT * FROM financial_metrics
        WHERE code = ?
        ORDER BY report_date DESC
        LIMIT 1
        """
        row = self.db.fetch_one(query, (code,))
        return dict(row) if row else None

    def get_balance_sheets(
        self,
        code: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """获取资产负债表数据"""
        query = """
        SELECT * FROM balance_sheets
        WHERE code = ?
        ORDER BY report_date DESC
        LIMIT ?
        """
        rows = self.db.fetch_all(query, (code, limit))
        return [dict(row) for row in rows]

    def get_income_statements(
        self,
        code: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """获取利润表数据"""
        query = """
        SELECT * FROM income_statements
        WHERE code = ?
        ORDER BY report_date DESC
        LIMIT ?
        """
        rows = self.db.fetch_all(query, (code, limit))
        return [dict(row) for row in rows]

    def get_cashflow_statements(
        self,
        code: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """获取现金流量表数据"""
        query = """
        SELECT * FROM cashflow_statements
        WHERE code = ?
        ORDER BY report_date DESC
        LIMIT ?
        """
        rows = self.db.fetch_all(query, (code, limit))
        return [dict(row) for row in rows]

    def get_full_finance_data(self, code: str) -> Dict[str, Any]:
        """获取某股票的完整财务数据"""
        return {
            "metrics": self.get_financial_metrics(code),
            "latest": self.get_latest_metrics(code),
            "balance_sheets": self.get_balance_sheets(code),
            "income_statements": self.get_income_statements(code),
            "cashflow_statements": self.get_cashflow_statements(code),
        }

    def get_finance_summary(self, code: str) -> Optional[Dict[str, Any]]:
        """获取财务数据摘要（仅最新一期主要指标）"""
        latest = self.get_latest_metrics(code)
        if not latest:
            return None

        return {
            "code": code,
            "report_date": latest.get("report_date"),
            "report_type": latest.get("report_type"),
            "eps": latest.get("eps"),
            "bps": latest.get("bps"),
            "revenue": latest.get("revenue"),
            "net_profit": latest.get("net_profit"),
            "deduct_net_profit": latest.get("deduct_net_profit"),
            "roe": latest.get("roe"),
            "roa": latest.get("roa"),
            "debt_ratio": latest.get("debt_ratio"),
            "gross_margin": latest.get("gross_margin"),
            "net_margin": latest.get("net_margin"),
            "current_ratio": latest.get("current_ratio"),
            "rev_yoy": latest.get("rev_yoy"),
            "profit_yoy": latest.get("profit_yoy"),
        }
