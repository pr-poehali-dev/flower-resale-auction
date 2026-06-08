"""Авторизация: регистрация, вход, профиль пользователя, выход"""
import json
import os
import hashlib
import secrets
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def hash_pwd(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()

def make_token() -> str:
    return secrets.token_hex(32)

def get_user_by_token(conn, token: str):
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name, u.phone, u.avatar_url, u.rating, u.reviews_count, "
            f"u.sales_count, u.purchases_count, u.balance, u.created_at, u.city "
            f"FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    if not row:
        return None
    cols = ["id","name","phone","avatar_url","rating","reviews_count","sales_count","purchases_count","balance","created_at","city"]
    d = dict(zip(cols, row))
    d["rating"] = float(d["rating"])
    d["balance"] = float(d["balance"])
    d["created_at"] = str(d["created_at"])
    return d

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    # action — из query string или из body (фронтенд дублирует для надёжности)
    action = qs.get("action") or body.get("action", "")

    # Токен из заголовка (прокси перекладывает Authorization -> X-Authorization)
    headers = event.get("headers") or {}
    auth_header = (
        headers.get("X-Authorization")
        or headers.get("x-authorization")
        or headers.get("Authorization")
        or headers.get("authorization")
        or ""
    )
    token = auth_header.replace("Bearer ", "").strip()

    conn = get_conn()
    try:
        # register
        if action == "register" and method == "POST":
            name = body.get("name", "").strip()
            phone = body.get("phone", "").strip()
            password = body.get("password", "")
            if not name or not phone or not password:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заполните все поля"})}
            with conn.cursor() as cur:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE phone = %s", (phone,))
                if cur.fetchone():
                    return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Телефон уже зарегистрирован"})}
                city = body.get("city", "").strip() or None
                cur.execute(
                    f"INSERT INTO {SCHEMA}.users (name, phone, password_hash, city) VALUES (%s, %s, %s, %s) RETURNING id",
                    (name, phone, hash_pwd(password), city)
                )
                user_id = cur.fetchone()[0]
                tok = make_token()
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)", (user_id, tok))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"token": tok, "user": {"id": user_id, "name": name, "phone": phone}})}

        # login
        if action == "login" and method == "POST":
            phone = body.get("phone", "").strip()
            password = body.get("password", "")
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, name FROM {SCHEMA}.users WHERE phone = %s AND password_hash = %s",
                    (phone, hash_pwd(password))
                )
                row = cur.fetchone()
            if not row:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Неверный телефон или пароль"})}
            tok = make_token()
            with conn.cursor() as cur:
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)", (row[0], tok))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"token": tok, "user": {"id": row[0], "name": row[1]}})}

        # me (GET)
        if action == "me" and method == "GET":
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            user = get_user_by_token(conn, token)
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Сессия истекла"})}
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"user": user})}

        # update profile
        if action == "update" and method == "POST":
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            user = get_user_by_token(conn, token)
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Сессия истекла"})}
            name = body.get("name")
            avatar_url = body.get("avatar_url")
            city = body.get("city")
            with conn.cursor() as cur:
                if name:
                    cur.execute(f"UPDATE {SCHEMA}.users SET name = %s WHERE id = %s", (name, user["id"]))
                if avatar_url:
                    cur.execute(f"UPDATE {SCHEMA}.users SET avatar_url = %s WHERE id = %s", (avatar_url, user["id"]))
                if city is not None:
                    cur.execute(f"UPDATE {SCHEMA}.users SET city = %s WHERE id = %s", (city, user["id"]))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # logout
        if action == "logout" and method == "POST":
            if token:
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token = %s", (token,))
                conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()