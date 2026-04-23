"""
数据库表结构定义

定义所有数据表的创建 SQL 语句
"""


class DatabaseSchema:
    """SQLite 数据库表结构定义"""

    # 股票基本信息表
    CREATE_STOCKS_TABLE = """
    CREATE TABLE IF NOT EXISTS stocks (
        code VARCHAR(10) PRIMARY KEY,
        name VARCHAR(50),
        market VARCHAR(10) DEFAULT 'cn',
        industry VARCHAR(50),
        list_date DATE,
        last_update DATETIME,
        status VARCHAR(20) DEFAULT 'pending',
        error_msg TEXT,
        UNIQUE(code)
    );
    """

    # 主要财务指标表
    CREATE_FINANCIAL_METRICS_TABLE = """
    CREATE TABLE IF NOT EXISTS financial_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(10) NOT NULL,
        report_date DATE NOT NULL,
        report_type VARCHAR(20),
        eps DECIMAL(10,4),
        bps DECIMAL(10,4),
        ocps DECIMAL(10,4),
        revenue BIGINT,
        gross_profit BIGINT,
        net_profit BIGINT,
        deduct_net_profit BIGINT,
        rev_yoy DECIMAL(10,2),
        profit_yoy DECIMAL(10,2),
        deduct_yoy DECIMAL(10,2),
        rev_qoq DECIMAL(10,2),
        profit_qoq DECIMAL(10,2),
        gross_margin DECIMAL(10,2),
        net_margin DECIMAL(10,2),
        roe DECIMAL(10,2),
        roa DECIMAL(10,2),
        inventory_days DECIMAL(10,2),
        receivable_days DECIMAL(10,2),
        total_asset_turnover DECIMAL(10,4),
        current_ratio DECIMAL(10,4),
        quick_ratio DECIMAL(10,4),
        debt_ratio DECIMAL(10,2),
        equity_multiplier DECIMAL(10,4),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code, report_date)
    );
    """

    # 资产负债表
    CREATE_BALANCE_SHEETS_TABLE = """
    CREATE TABLE IF NOT EXISTS balance_sheets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(10) NOT NULL,
        report_date DATE NOT NULL,
        report_type VARCHAR(20),
        total_assets BIGINT,
        monetary_funds BIGINT,
        accounts_receivable BIGINT,
        inventory BIGINT,
        fixed_assets BIGINT,
        total_liabilities BIGINT,
        accounts_payable BIGINT,
        total_equity BIGINT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code, report_date)
    );
    """

    # 利润表
    CREATE_INCOME_STATEMENTS_TABLE = """
    CREATE TABLE IF NOT EXISTS income_statements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(10) NOT NULL,
        report_date DATE NOT NULL,
        report_type VARCHAR(20),
        total_operate_income BIGINT,
        operate_cost BIGINT,
        total_operate_cost BIGINT,
        operate_profit BIGINT,
        total_profit BIGINT,
        parent_net_profit BIGINT,
        deduct_net_profit BIGINT,
        finance_expense BIGINT,
        manage_expense BIGINT,
        sale_expense BIGINT,
        tax_and_surcharges BIGINT,
        income_tax BIGINT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code, report_date)
    );
    """

    # 现金流量表
    CREATE_CASHFLOW_STATEMENTS_TABLE = """
    CREATE TABLE IF NOT EXISTS cashflow_statements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(10) NOT NULL,
        report_date DATE NOT NULL,
        report_type VARCHAR(20),
        cash_change BIGINT,
        netcash_operate BIGINT,
        netcash_invest BIGINT,
        netcash_finance BIGINT,
        sales_services BIGINT,
        pay_staff_cash BIGINT,
        construct_long_asset BIGINT,
        receive_invest_income BIGINT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code, report_date)
    );
    """

    # 任务进度表
    CREATE_TASK_PROGRESS_TABLE = """
    CREATE TABLE IF NOT EXISTS task_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name VARCHAR(100) NOT NULL UNIQUE,
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        current_index INTEGER DEFAULT 0,
        last_code VARCHAR(10),
        status VARCHAR(20) DEFAULT 'running',
        started_at DATETIME,
        updated_at DATETIME,
        completed_at DATETIME,
        UNIQUE(task_name)
    );
    """

    # 更新日志表
    CREATE_UPDATE_LOG_TABLE = """
    CREATE TABLE IF NOT EXISTS update_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        stocks_updated INTEGER DEFAULT 0,
        records_added INTEGER DEFAULT 0,
        stocks_checked INTEGER DEFAULT 0,
        season VARCHAR(20),
        status VARCHAR(20) DEFAULT 'success',
        error_msg TEXT
    );
    """

    # 表结构迁移 SQL（用于给已有表添加新字段）
    MIGRATION_SQLS = [
        "ALTER TABLE stocks ADD COLUMN last_report_season VARCHAR(20);",
    ]

    # 索引创建语句
    CREATE_INDEXES = [
        "CREATE INDEX IF NOT EXISTS idx_finance_code ON financial_metrics(code);",
        "CREATE INDEX IF NOT EXISTS idx_finance_date ON financial_metrics(report_date);",
        "CREATE INDEX IF NOT EXISTS idx_balance_code ON balance_sheets(code);",
        "CREATE INDEX IF NOT EXISTS idx_income_code ON income_statements(code);",
        "CREATE INDEX IF NOT EXISTS idx_cashflow_code ON cashflow_statements(code);",
        "CREATE INDEX IF NOT EXISTS idx_stocks_status ON stocks(status);",
        "CREATE INDEX IF NOT EXISTS idx_update_log_time ON update_log(update_time);",
    ]

    # 所有表的创建语句列表
    ALL_TABLES = [
        CREATE_STOCKS_TABLE,
        CREATE_FINANCIAL_METRICS_TABLE,
        CREATE_BALANCE_SHEETS_TABLE,
        CREATE_INCOME_STATEMENTS_TABLE,
        CREATE_CASHFLOW_STATEMENTS_TABLE,
        CREATE_TASK_PROGRESS_TABLE,
        CREATE_UPDATE_LOG_TABLE,
    ]
