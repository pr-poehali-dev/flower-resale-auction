"""
OAuth авторизация: VK, Google, Telegram
Схема: фронтенд редиректит на провайдера → провайдер возвращает code →
фронтенд передаёт code сюда → получаем токен, достаём профиль, создаём/находим юзера
"""
import json
import os
import secrets
import hashlib
import hmac
import time
import urllib.request
import urllib.parse
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def make_token():
    return secrets.token_hex(32)

def http_get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read())

def http_post(url, data):
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def upsert_oauth_user(conn, provider: str, provider_id: str, name: str, avatar_url: str = None, city: str = None):
    """Находит или создаёт пользователя по OAuth, возвращает user_id и token"""
    with conn.cursor() as cur:
        # Ищем по provider + provider_id
        cur.execute(
            f"SELECT u.id, u.name FROM {SCHEMA}.users u "
            f"WHERE u.oauth_provider = %s AND u.oauth_id = %s",
            (provider, provider_id)
        )
        row = cur.fetchone()

        if row:
            user_id = row[0]
            # Обновляем аватар если есть
            if avatar_url:
                cur.execute(f"UPDATE {SCHEMA}.users SET avatar_url = %s WHERE id = %s", (avatar_url, user_id))
        else:
            # Создаём нового пользователя
            fake_phone = f"+oauth_{provider}_{provider_id}"
            fake_hash = hashlib.sha256(f"oauth_{provider}_{provider_id}".encode()).hexdigest()
            cur.execute(
                f"INSERT INTO {SCHEMA}.users (name, phone, password_hash, avatar_url, oauth_provider, oauth_id, city) "
                f"VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (name, fake_phone, fake_hash, avatar_url, provider, provider_id, city)
            )
            user_id = cur.fetchone()[0]

        # Создаём сессию
        tok = make_token()
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user_id, tok)
        )
    conn.commit()
    return user_id, tok

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    body = json.loads(event.get("body") or "{}")

    conn = get_conn()
    try:

        # ── VK ID SDK (OneTap) ───────────────────────────────
        # POST /?action=vkid_callback
        # VKID.Auth.exchangeCode выполняется на клиенте — SDK возвращает готовый access_token.
        # Мы получаем access_token + vk_user_id и сразу запрашиваем профиль.
        if action == "vkid_callback":
            access_token = body.get("code", "")   # фронт кладёт access_token в поле "code"
            vk_user_id = body.get("device_id", "") # и vk_user_id в поле "device_id"

            if not access_token or not vk_user_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нет токена VK"})}

            # Получаем профиль через VK API
            profile = http_get(
                f"https://api.vk.com/method/users.get?user_ids={vk_user_id}"
                f"&fields=photo_200,city&access_token={access_token}&v=5.131"
            )
            resp = profile.get("response", [{}])
            user_info = resp[0] if resp else {}
            name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or "VK Пользователь"
            avatar = user_info.get("photo_200")
            city_data = user_info.get("city", {})
            city = city_data.get("title") if isinstance(city_data, dict) else None

            user_id, tok = upsert_oauth_user(conn, "vk", str(vk_user_id), name, avatar, city)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "token": tok, "user": {"id": user_id, "name": name}
            })}

        # ── VK OAuth (legacy redirect, оставляем для совместимости) ──
        if action == "vk_callback":
            code = body.get("code", "")
            redirect_uri = body.get("redirect_uri", "")
            app_id = os.environ.get("VK_APP_ID", "")
            app_secret = os.environ.get("VK_APP_SECRET", "")
            if not app_id or not app_secret:
                return {"statusCode": 503, "headers": CORS, "body": json.dumps({"error": "VK не настроен."})}
            token_data = http_get(
                f"https://oauth.vk.com/access_token?client_id={app_id}&client_secret={app_secret}"
                f"&redirect_uri={urllib.parse.quote(redirect_uri)}&code={code}"
            )
            if "error" in token_data:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Ошибка VK: " + token_data.get("error_description", "")})}
            vk_token = token_data["access_token"]
            vk_user_id = str(token_data["user_id"])
            profile = http_get(
                f"https://api.vk.com/method/users.get?user_ids={vk_user_id}"
                f"&fields=photo_200,city&access_token={vk_token}&v=5.131"
            )
            user_info = profile["response"][0]
            name = f"{user_info.get('first_name','')} {user_info.get('last_name','')}".strip()
            avatar = user_info.get("photo_200")
            city = user_info.get("city", {}).get("title") if isinstance(user_info.get("city"), dict) else None
            user_id, tok = upsert_oauth_user(conn, "vk", vk_user_id, name, avatar, city)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"token": tok, "user": {"id": user_id, "name": name}})}

        # ── GOOGLE ──────────────────────────────────────────
        if action == "google_url":
            client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
            redirect_uri = qs.get("redirect_uri", "")
            if not client_id:
                return {"statusCode": 503, "headers": CORS, "body": json.dumps({"error": "Google не настроен"})}
            params = urllib.parse.urlencode({
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "access_type": "online",
            })
            url = f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"url": url})}

        if action == "google_callback":
            code = body.get("code", "")
            redirect_uri = body.get("redirect_uri", "")
            client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
            client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
            if not client_id or not client_secret:
                return {"statusCode": 503, "headers": CORS, "body": json.dumps({"error": "Google не настроен. Добавьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET."})}

            # Меняем code на токен
            token_data = http_post("https://oauth2.googleapis.com/token", {
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            })
            if "error" in token_data:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Ошибка Google: " + token_data.get("error", "")})}

            # Получаем профиль
            access_token = token_data["access_token"]
            profile = http_get(f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={access_token}")
            google_id = str(profile["id"])
            name = profile.get("name", "Пользователь")
            avatar = profile.get("picture")

            user_id, tok = upsert_oauth_user(conn, "google", google_id, name, avatar)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"token": tok, "user": {"id": user_id, "name": name}})}

        # ── TELEGRAM ────────────────────────────────────────
        if action == "telegram_callback":
            # Telegram передаёт данные через hash-проверку
            tg_data = body.get("telegram_data", {})
            bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
            if not bot_token:
                return {"statusCode": 503, "headers": CORS, "body": json.dumps({"error": "Telegram не настроен. Добавьте TELEGRAM_BOT_TOKEN."})}

            # Проверяем подпись
            check_hash = tg_data.pop("hash", "")
            data_check_arr = [f"{k}={v}" for k, v in sorted(tg_data.items())]
            data_check_str = "\n".join(data_check_arr)
            secret_key = hashlib.sha256(bot_token.encode()).digest()
            computed = hmac.new(secret_key, data_check_str.encode(), hashlib.sha256).hexdigest()

            if computed != check_hash:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Неверная подпись Telegram"})}

            # Проверяем свежесть (5 минут)
            if time.time() - int(tg_data.get("auth_date", 0)) > 300:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Данные Telegram устарели"})}

            tg_id = str(tg_data["id"])
            name = f"{tg_data.get('first_name','')} {tg_data.get('last_name','')}".strip() or tg_data.get("username", "Пользователь")
            avatar = tg_data.get("photo_url")

            user_id, tok = upsert_oauth_user(conn, "telegram", tg_id, name, avatar)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"token": tok, "user": {"id": user_id, "name": name}})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()