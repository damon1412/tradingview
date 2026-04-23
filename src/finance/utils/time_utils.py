"""
时间控制工具

提供速率限制器和进度显示功能
"""

import time
from typing import Optional


class RateLimiter:
    """
    速率限制器

    用于控制请求频率，防止被封禁
    """

    def __init__(self, min_interval: float = 1.0):
        """
        Args:
            min_interval: 最小请求间隔（秒），默认1秒
        """
        self.min_interval = min_interval
        self.last_request_time: float = 0

    def wait(self):
        """
        等待直到可以发送下一个请求

        如果距离上次请求的时间小于最小间隔，则等待剩余时间
        """
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request_time = time.time()

    def set_speed(self, requests_per_minute: int):
        """
        根据每分钟请求数动态调整间隔

        Args:
            requests_per_minute: 每分钟请求数
        """
        if requests_per_minute <= 0:
            self.min_interval = 60.0
        else:
            self.min_interval = 60.0 / requests_per_minute

    def get_interval(self) -> float:
        """获取当前请求间隔"""
        return self.min_interval
