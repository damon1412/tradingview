"""
日志工具

提供统一的日志配置和管理功能
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from typing import Optional


_loggers = {}


def setup_logger(
    name: str = "finance",
    log_file: str = "finance.log",
    level: int = logging.INFO,
    console: bool = True,
) -> logging.Logger:
    """
    配置日志系统
    """
    if name in _loggers:
        return _loggers[name]

    logger = logging.getLogger(name)
    logger.setLevel(level)

    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if log_file:
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)

        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    if console:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(level)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    _loggers[name] = logger
    return logger


def get_logger(name: str = "finance") -> logging.Logger:
    """
    获取已配置的日志记录器
    """
    if name not in _loggers:
        return setup_logger(name)
    return _loggers[name]
