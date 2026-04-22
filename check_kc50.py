#!/usr/bin/env python3
import requests, json
from datetime import datetime

resp = requests.get("http://localhost:8080/api/index", params={"code": "sh000688", "type": "minute1", "limit": 20000})
d = resp.json()
items = d.get("data", {}).get("List", [])
items.reverse()

# 模拟前端逻辑：选中日线 4-8 至 4-22
# 日线数据中的时间戳范围
from datetime import timezone, timedelta
tz = timezone(timedelta(hours=8))
start_ts = datetime(2026, 4, 8, 0, 0, 0, tzinfo=tz).timestamp() * 1000
end_ts = datetime(2026, 4, 22, 23, 59, 59, tzinfo=tz).timestamp() * 1000

print(f"选中区间: 2026-04-08 ~ 2026-04-22")
print(f"1分钟数据总量: {len(items)}条")

# 解析1分钟数据的时间戳
converted = []
for item in items:
    t = item["Time"]
    ts_str = t.replace("+08:00", "+0800")
    try:
        dt = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S%z")
        ts = int(dt.timestamp() * 1000)
        converted.append({"Time": t, "ts": ts, "Close": item["Close"], "Volume": item["Volume"]})
    except:
        pass

print(f"转换成功: {len(converted)}条")

# 过滤
filtered = [i for i in converted if start_ts <= i["ts"] <= end_ts]
print(f"过滤后（4-8至4-22）: {len(filtered)}条")

if filtered:
    prices = [i["Close"]/1000 for i in filtered]
    print(f"价格范围: {min(prices):.2f} - {max(prices):.2f}")
    print(f"第一条: {filtered[0]['Time']}")
    print(f"最后一条: {filtered[-1]['Time']}")
    
    # 计算POC
    vol_by_price = {}
    for i in filtered:
        p = round(i["Close"]/1000, 2)
        vol_by_price[p] = vol_by_price.get(p, 0) + i["Volume"]
    poc = max(vol_by_price, key=vol_by_price.get)
    print(f"POC: {poc}")
else:
    print("无匹配数据！")
