"""
财务数据模块主入口

用于初始化数据库连接和启动API服务
"""

import os
from typing import Optional

from .database.connection import DatabaseManager
from .database.schema import DatabaseSchema
from .api.routes import init_finance_api, router

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "finance.db")

db_manager: Optional[DatabaseManager] = None


def initialize(db_path: str = DEFAULT_DB_PATH):
    """初始化财务数据模块"""
    global db_manager
    
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    db_manager = DatabaseManager(db_path)
    db_manager.initialize()
    
    init_finance_api(db_path)
    
    return router


def get_db_manager() -> DatabaseManager:
    """获取数据库管理器实例"""
    if db_manager is None:
        raise RuntimeError("财务数据模块未初始化，请先调用 initialize()")
    return db_manager
