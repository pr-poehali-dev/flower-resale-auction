"""Пополнение баланса через ЮKassa: создание платежа и обработка уведомлений (webhook). v2"""
import json
import os
import uuid
import base64
import urllib.request
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_user(conn, token: str):
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name FROM {SCHEMA}.sessions s "
            f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    return {"id": row[0], "name": row[1]} if row else None


def yookassa_create_payment(amount: float, return_url: str, user_id: int):
    shop_id = os.environ["YOOKASSA_SHOP_ID"]
    secret = os.environ["YOOKASSA_SECRET_KEY"]
    auth = base64.b64encode(f"{shop_id}:{secret}".encode()).decode()
    payload = json.dumps({
        "amount": {"value": f"{amount:.2f}", "currency": "RUB"},
        "confirmation": {"type": "redirect", "return_url": return_url},
        "capture": True,
        "description": f"Пополнение баланса FlowerFlip (user {user_id})",
        "metadata": {"user_id": str(user_id)},
    }).encode()
    req = urllib.request.Request(
        "https://api.yookassa.ru/v3/payments",
        data=payload,
        headers={
            "Authorization": f"Basic {auth}",
            "Idempotence-Key": str(uuid.uuid4()),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


def handler(event: dict, context) -> dict:
    """Пополнение баланса через ЮKassa и приём webhook об успешной оплате"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        # Создать платёж на пополнение
        if action == "topup" and method == "POST":
            user = get_user(conn, token)
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            amount = float(body.get("amount", 0))
            if amount < 10:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Минимальная сумма 10 ₽"})}
            return_url = body.get("return_url", "https://flowerflip.ru")
            payment = yookassa_create_payment(amount, return_url, user["id"])
            confirm_url = payment.get("confirmation", {}).get("confirmation_url")
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "ok": True, "confirmation_url": confirm_url, "payment_id": payment.get("id")
            })}

        # Webhook от ЮKassa об успешной оплате
        if action == "webhook" and method == "POST":
            obj = body.get("object", {})
            if body.get("event") == "payment.succeeded" and obj.get("status") == "succeeded":
                user_id = int(obj.get("metadata", {}).get("user_id", 0))
                amount = float(obj.get("amount", {}).get("value", 0))
                if user_id and amount > 0:
                    with conn.cursor() as cur:
                        cur.execute(
                            f"UPDATE {SCHEMA}.users SET balance = balance + %s WHERE id = %s",
                            (amount, user_id)
                        )
                    conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()