"""
数据模型类

定义股票、财务指标、资产负债表、利润表、现金流量表、任务进度等数据模型
"""

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
import sqlite3
from .connection import DatabaseManager


@dataclass
class Stock:
    """股票基本信息模型"""
    code: str
    name: str = ""
    market: str = "cn"
    industry: str = ""
    list_date: Optional[date] = None
    last_update: Optional[datetime] = None
    status: str = "pending"
    error_msg: str = ""

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "code": self.code,
            "name": self.name,
            "market": self.market,
            "industry": self.industry,
            "list_date": self.list_date.isoformat() if self.list_date else None,
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "status": self.status,
            "error_msg": self.error_msg,
        }

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Stock":
        """从数据库行创建模型"""
        return cls(
            code=row["code"],
            name=row["name"] or "",
            market=row["market"] or "cn",
            industry=row["industry"] or "",
            list_date=datetime.strptime(row["list_date"], "%Y-%m-%d").date() if row["list_date"] else None,
            last_update=datetime.fromisoformat(row["last_update"]) if row["last_update"] else None,
            status=row["status"] or "pending",
            error_msg=row["error_msg"] or "",
        )


@dataclass
class FinancialMetric:
    """主要财务指标模型"""
    code: str
    report_date: date
    report_type: str = ""
    eps: Optional[float] = None
    bps: Optional[float] = None
    ocps: Optional[float] = None
    revenue: Optional[int] = None
    gross_profit: Optional[int] = None
    net_profit: Optional[int] = None
    deduct_net_profit: Optional[int] = None
    rev_yoy: Optional[float] = None
    profit_yoy: Optional[float] = None
    deduct_yoy: Optional[float] = None
    rev_qoq: Optional[float] = None
    profit_qoq: Optional[float] = None
    gross_margin: Optional[float] = None
    net_margin: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    inventory_days: Optional[float] = None
    receivable_days: Optional[float] = None
    total_asset_turnover: Optional[float] = None
    current_ratio: Optional[float] = None
    quick_ratio: Optional[float] = None
    debt_ratio: Optional[float] = None
    equity_multiplier: Optional[float] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "code": self.code,
            "report_date": self.report_date.isoformat() if isinstance(self.report_date, date) else self.report_date,
            "report_type": self.report_type,
            "eps": self.eps,
            "bps": self.bps,
            "ocps": self.ocps,
            "revenue": self.revenue,
            "gross_profit": self.gross_profit,
            "net_profit": self.net_profit,
            "deduct_net_profit": self.deduct_net_profit,
            "rev_yoy": self.rev_yoy,
            "profit_yoy": self.profit_yoy,
            "deduct_yoy": self.deduct_yoy,
            "rev_qoq": self.rev_qoq,
            "profit_qoq": self.profit_qoq,
            "gross_margin": self.gross_margin,
            "net_margin": self.net_margin,
            "roe": self.roe,
            "roa": self.roa,
            "inventory_days": self.inventory_days,
            "receivable_days": self.receivable_days,
            "total_asset_turnover": self.total_asset_turnover,
            "current_ratio": self.current_ratio,
            "quick_ratio": self.quick_ratio,
            "debt_ratio": self.debt_ratio,
            "equity_multiplier": self.equity_multiplier,
        }

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "FinancialMetric":
        """从数据库行创建模型"""
        return cls(
            code=row["code"],
            report_date=datetime.strptime(row["report_date"], "%Y-%m-%d").date() if row["report_date"] else date.min,
            report_type=row["report_type"] or "",
            eps=float(row["eps"]) if row["eps"] else None,
            bps=float(row["bps"]) if row["bps"] else None,
            ocps=float(row["ocps"]) if row["ocps"] else None,
            revenue=int(row["revenue"]) if row["revenue"] else None,
            gross_profit=int(row["gross_profit"]) if row["gross_profit"] else None,
            net_profit=int(row["net_profit"]) if row["net_profit"] else None,
            deduct_net_profit=int(row["deduct_net_profit"]) if row["deduct_net_profit"] else None,
            rev_yoy=float(row["rev_yoy"]) if row["rev_yoy"] else None,
            profit_yoy=float(row["profit_yoy"]) if row["profit_yoy"] else None,
            deduct_yoy=float(row["deduct_yoy"]) if row["deduct_yoy"] else None,
            rev_qoq=float(row["rev_qoq"]) if row["rev_qoq"] else None,
            profit_qoq=float(row["profit_qoq"]) if row["profit_qoq"] else None,
            gross_margin=float(row["gross_margin"]) if row["gross_margin"] else None,
            net_margin=float(row["net_margin"]) if row["net_margin"] else None,
            roe=float(row["roe"]) if row["roe"] else None,
            roa=float(row["roa"]) if row["roa"] else None,
            inventory_days=float(row["inventory_days"]) if row["inventory_days"] else None,
            receivable_days=float(row["receivable_days"]) if row["receivable_days"] else None,
            total_asset_turnover=float(row["total_asset_turnover"]) if row["total_asset_turnover"] else None,
            current_ratio=float(row["current_ratio"]) if row["current_ratio"] else None,
            quick_ratio=float(row["quick_ratio"]) if row["quick_ratio"] else None,
            debt_ratio=float(row["debt_ratio"]) if row["debt_ratio"] else None,
            equity_multiplier=float(row["equity_multiplier"]) if row["equity_multiplier"] else None,
        )

    @classmethod
    def from_api_data(cls, code: str, data: dict) -> "FinancialMetric":
        """从 API 数据创建模型"""
        report_date_str = data.get("report_date", "")
        if isinstance(report_date_str, str) and report_date_str:
            report_date = datetime.strptime(report_date_str[:10], "%Y-%m-%d").date()
        else:
            report_date = date.min

        return cls(
            code=code,
            report_date=report_date,
            report_type=data.get("report_type", ""),
            eps=_to_float(data.get("eps")),
            bps=_to_float(data.get("bps")),
            ocps=_to_float(data.get("ocps")),
            revenue=_to_int(data.get("revenue")),
            gross_profit=_to_int(data.get("gross_profit")),
            net_profit=_to_int(data.get("net_profit")),
            deduct_net_profit=_to_int(data.get("deduct_net_profit")),
            rev_yoy=_to_float(data.get("rev_yoy")),
            profit_yoy=_to_float(data.get("profit_yoy")),
            deduct_yoy=_to_float(data.get("deduct_yoy")),
            rev_qoq=_to_float(data.get("rev_qoq")),
            profit_qoq=_to_float(data.get("profit_qoq")),
            gross_margin=_to_float(data.get("gross_margin")),
            net_margin=_to_float(data.get("net_margin")),
            roe=_to_float(data.get("roe")),
            roa=_to_float(data.get("roa")),
            inventory_days=_to_float(data.get("inventory_days")),
            receivable_days=_to_float(data.get("receivable_days")),
            total_asset_turnover=_to_float(data.get("total_asset_turnover")),
            current_ratio=_to_float(data.get("current_ratio")),
            quick_ratio=_to_float(data.get("quick_ratio")),
            debt_ratio=_to_float(data.get("debt_ratio")),
            equity_multiplier=_to_float(data.get("equity_multiplier")),
        )


@dataclass
class BalanceSheet:
    """资产负债表模型"""
    code: str
    report_date: date
    report_type: str = ""
    total_assets: Optional[int] = None
    monetary_funds: Optional[int] = None
    accounts_receivable: Optional[int] = None
    inventory: Optional[int] = None
    fixed_assets: Optional[int] = None
    total_liabilities: Optional[int] = None
    accounts_payable: Optional[int] = None
    total_equity: Optional[int] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "code": self.code,
            "report_date": self.report_date.isoformat() if isinstance(self.report_date, date) else self.report_date,
            "report_type": self.report_type,
            "total_assets": self.total_assets,
            "monetary_funds": self.monetary_funds,
            "accounts_receivable": self.accounts_receivable,
            "inventory": self.inventory,
            "fixed_assets": self.fixed_assets,
            "total_liabilities": self.total_liabilities,
            "accounts_payable": self.accounts_payable,
            "total_equity": self.total_equity,
        }

    @classmethod
    def from_api_data(cls, code: str, data: dict) -> "BalanceSheet":
        """从 API 数据创建模型"""
        report_date_str = data.get("report_date", "")
        if isinstance(report_date_str, str) and report_date_str:
            report_date = datetime.strptime(report_date_str[:10], "%Y-%m-%d").date()
        else:
            report_date = date.min

        return cls(
            code=code,
            report_date=report_date,
            report_type=data.get("report_type", ""),
            total_assets=_to_int(data.get("total_assets")),
            monetary_funds=_to_int(data.get("monetary_funds")),
            accounts_receivable=_to_int(data.get("accounts_receivable")),
            inventory=_to_int(data.get("inventory")),
            fixed_assets=_to_int(data.get("fixed_assets")),
            total_liabilities=_to_int(data.get("total_liabilities")),
            accounts_payable=_to_int(data.get("accounts_payable")),
            total_equity=_to_int(data.get("total_equity")),
        )


@dataclass
class IncomeStatement:
    """利润表模型"""
    code: str
    report_date: date
    report_type: str = ""
    total_operate_income: Optional[int] = None
    operate_cost: Optional[int] = None
    total_operate_cost: Optional[int] = None
    operate_profit: Optional[int] = None
    total_profit: Optional[int] = None
    parent_net_profit: Optional[int] = None
    deduct_net_profit: Optional[int] = None
    finance_expense: Optional[int] = None
    manage_expense: Optional[int] = None
    sale_expense: Optional[int] = None
    tax_and_surcharges: Optional[int] = None
    income_tax: Optional[int] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "code": self.code,
            "report_date": self.report_date.isoformat() if isinstance(self.report_date, date) else self.report_date,
            "report_type": self.report_type,
            "total_operate_income": self.total_operate_income,
            "operate_cost": self.operate_cost,
            "total_operate_cost": self.total_operate_cost,
            "operate_profit": self.operate_profit,
            "total_profit": self.total_profit,
            "parent_net_profit": self.parent_net_profit,
            "deduct_net_profit": self.deduct_net_profit,
            "finance_expense": self.finance_expense,
            "manage_expense": self.manage_expense,
            "sale_expense": self.sale_expense,
            "tax_and_surcharges": self.tax_and_surcharges,
            "income_tax": self.income_tax,
        }

    @classmethod
    def from_api_data(cls, code: str, data: dict) -> "IncomeStatement":
        """从 API 数据创建模型"""
        report_date_str = data.get("report_date", "")
        if isinstance(report_date_str, str) and report_date_str:
            report_date = datetime.strptime(report_date_str[:10], "%Y-%m-%d").date()
        else:
            report_date = date.min

        return cls(
            code=code,
            report_date=report_date,
            report_type=data.get("report_type", ""),
            total_operate_income=_to_int(data.get("total_operate_income")),
            operate_cost=_to_int(data.get("operate_cost")),
            total_operate_cost=_to_int(data.get("total_operate_cost")),
            operate_profit=_to_int(data.get("operate_profit")),
            total_profit=_to_int(data.get("total_profit")),
            parent_net_profit=_to_int(data.get("parent_net_profit")),
            deduct_net_profit=_to_int(data.get("deduct_net_profit")),
            finance_expense=_to_int(data.get("finance_expense")),
            manage_expense=_to_int(data.get("manage_expense")),
            sale_expense=_to_int(data.get("sale_expense")),
            tax_and_surcharges=_to_int(data.get("tax_and_surcharges")),
            income_tax=_to_int(data.get("income_tax")),
        )


@dataclass
class CashflowStatement:
    """现金流量表模型"""
    code: str
    report_date: date
    report_type: str = ""
    cash_change: Optional[int] = None
    netcash_operate: Optional[int] = None
    netcash_invest: Optional[int] = None
    netcash_finance: Optional[int] = None
    sales_services: Optional[int] = None
    pay_staff_cash: Optional[int] = None
    construct_long_asset: Optional[int] = None
    receive_invest_income: Optional[int] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "code": self.code,
            "report_date": self.report_date.isoformat() if isinstance(self.report_date, date) else self.report_date,
            "report_type": self.report_type,
            "cash_change": self.cash_change,
            "netcash_operate": self.netcash_operate,
            "netcash_invest": self.netcash_invest,
            "netcash_finance": self.netcash_finance,
            "sales_services": self.sales_services,
            "pay_staff_cash": self.pay_staff_cash,
            "construct_long_asset": self.construct_long_asset,
            "receive_invest_income": self.receive_invest_income,
        }

    @classmethod
    def from_api_data(cls, code: str, data: dict) -> "CashflowStatement":
        """从 API 数据创建模型"""
        report_date_str = data.get("report_date", "")
        if isinstance(report_date_str, str) and report_date_str:
            report_date = datetime.strptime(report_date_str[:10], "%Y-%m-%d").date()
        else:
            report_date = date.min

        return cls(
            code=code,
            report_date=report_date,
            report_type=data.get("report_type", ""),
            cash_change=_to_int(data.get("cash_change")),
            netcash_operate=_to_int(data.get("netcash_operate")),
            netcash_invest=_to_int(data.get("netcash_invest")),
            netcash_finance=_to_int(data.get("netcash_finance")),
            sales_services=_to_int(data.get("sales_services")),
            pay_staff_cash=_to_int(data.get("pay_staff_cash")),
            construct_long_asset=_to_int(data.get("construct_long_asset")),
            receive_invest_income=_to_int(data.get("receive_invest_income")),
        )


@dataclass
class TaskProgress:
    """任务进度模型"""
    task_name: str
    total_count: int = 0
    success_count: int = 0
    failed_count: int = 0
    current_index: int = 0
    last_code: str = ""
    status: str = "pending"
    started_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "task_name": self.task_name,
            "total_count": self.total_count,
            "success_count": self.success_count,
            "failed_count": self.failed_count,
            "current_index": self.current_index,
            "last_code": self.last_code,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "TaskProgress":
        """从数据库行创建模型"""
        return cls(
            task_name=row["task_name"],
            total_count=row["total_count"] or 0,
            success_count=row["success_count"] or 0,
            failed_count=row["failed_count"] or 0,
            current_index=row["current_index"] or 0,
            last_code=row["last_code"] or "",
            status=row["status"] or "pending",
            started_at=datetime.fromisoformat(row["started_at"]) if row["started_at"] else None,
            updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None,
            completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
        )


def _to_float(value: Any) -> Optional[float]:
    """安全转换为浮点数"""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _to_int(value: Any) -> Optional[int]:
    """安全转换为整数"""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None
