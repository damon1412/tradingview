"""
数据库连接管理

负责数据库连接、初始化、表创建等操作
"""

import sqlite3
import os
from typing import Optional
from .schema import DatabaseSchema


class DatabaseManager:
    """数据库管理器（单例模式）"""

    _instance: Optional["DatabaseManager"] = None
    _connection: Optional[sqlite3.Connection] = None

    def __new__(cls, db_path: str = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._db_path = None
            cls._instance._connection = None
        return cls._instance

    def __init__(self, db_path: str = None):
        if db_path and db_path != self._db_path:
            self._db_path = db_path
            self._connection = None

    @property
    def db_path(self) -> str:
        """获取数据库路径"""
        return self._db_path

    @property
    def connection(self) -> sqlite3.Connection:
        """获取数据库连接（懒加载）"""
        if self._connection is None:
            self._connect()
        return self._connection

    def _connect(self):
        """建立数据库连接"""
        if not self._db_path:
            raise ValueError("数据库路径未设置")

        db_dir = os.path.dirname(self._db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)

        self._connection = sqlite3.connect(self._db_path, check_same_thread=True)
        self._connection.row_factory = sqlite3.Row

    def initialize(self):
        """
        初始化数据库

        创建所有必要的表和索引，并执行必要的迁移
        """
        cursor = self.connection.cursor()

        for table_sql in DatabaseSchema.ALL_TABLES:
            cursor.executescript(table_sql)

        for index_sql in DatabaseSchema.CREATE_INDEXES:
            cursor.execute(index_sql)

        for migration_sql in DatabaseSchema.MIGRATION_SQLS:
            try:
                cursor.execute(migration_sql)
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    pass
                else:
                    raise

        self.connection.commit()

    def close(self):
        """关闭数据库连接"""
        if self._connection:
            self._connection.close()
            self._connection = None

    def execute(self, sql: str, params: tuple = None) -> sqlite3.Cursor:
        """
        执行 SQL 语句

        Args:
            sql: SQL 语句
            params: 参数元组

        Returns:
            游标对象
        """
        cursor = self.connection.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor

    def executescript(self, sql: str):
        """
        执行多条 SQL 语句

        Args:
            sql: SQL 脚本
        """
        cursor = self.connection.cursor()
        cursor.executescript(sql)

    def commit(self):
        """提交事务"""
        if self._connection:
            self._connection.commit()

    def rollback(self):
        """回滚事务"""
        if self._connection:
            self._connection.rollback()

    def fetch_one(self, sql: str, params: tuple = None) -> Optional[sqlite3.Row]:
        """
        查询单条记录

        Args:
            sql: SQL 语句
            params: 参数元组

        Returns:
            单条记录或 None
        """
        cursor = self.connection.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor.fetchone()

    def fetch_all(self, sql: str, params: tuple = None) -> list:
        """
        查询所有记录

        Args:
            sql: SQL 语句
            params: 参数元组

        Returns:
            记录列表
        """
        cursor = self.connection.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor.fetchall()

    @classmethod
    def get_instance(cls) -> "DatabaseManager":
        """获取单例实例"""
        if cls._instance is None:
            raise ValueError("DatabaseManager 未初始化，请先调用 DatabaseManager(db_path)")
        return cls._instance

    @classmethod
    def reset_instance(cls):
        """重置单例实例（用于测试或切换数据库）"""
        if cls._instance and cls._instance._connection:
            cls._instance._connection.close()
        cls._instance = None
