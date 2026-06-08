"""Справочник городов России: возвращает полный список названий городов"""
import json
import urllib.request

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SOURCE_URL = "https://raw.githubusercontent.com/pensnarik/russian-cities/master/russian-cities.json"

# Кэш в памяти контейнера, чтобы не качать на каждый вызов
_CACHE = {"cities": None}


def load_cities():
    if _CACHE["cities"] is not None:
        return _CACHE["cities"]
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    names = sorted({item["name"] for item in data if item.get("name")})
    _CACHE["cities"] = names
    return names


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    cities = load_cities()
    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({"cities": cities}, ensure_ascii=False),
    }
