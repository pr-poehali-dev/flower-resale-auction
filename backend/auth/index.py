"""Авторизация: регистрация, вход по телефону или email, сброс пароля, обновление профиля. v3"""
import json
import os
import hashlib
import secrets
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}
SITE_EMAIL = "flowerflip@flowerflip.ru"
SITE_URL = "https://flowerflip.ru"

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def hash_pwd(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()

def make_token() -> str:
    return secrets.token_hex(32)

def send_email(to_email: str, subject: str, html: str):
    smtp_password = os.environ.get("SMTP_PASSWORD", "")
    if not smtp_password:
        print("[SMTP] No password configured")
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"FlowerFlip <{SITE_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("mail.hosting.reg.ru", 465, context=context) as server:
            server.login(SITE_EMAIL, smtp_password)
            server.sendmail(SITE_EMAIL, to_email, msg.as_string())
    except Exception as e:
        print(f"[SMTP ERROR] {e}")

def send_verify_email(to_email: str, token: str, name: str):
    verify_url = f"{SITE_URL}/?verify_email={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0a18;color:#fff;border-radius:16px;">
      <h1 style="color:#ff3d8b;font-size:24px;margin-bottom:8px;">🌸 FlowerFlip</h1>
      <p style="color:#ccc;margin-bottom:24px;">Привет, {name}! Подтверди свой email чтобы получать уведомления о ставках и сделках.</p>
      <a href="{verify_url}" style="display:inline-block;background:linear-gradient(135deg,#ff3d8b,#a855f7);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:bold;font-size:16px;">Подтвердить email</a>
      <p style="color:#555;font-size:12px;margin-top:24px;">Ссылка действительна 24 часа. Если вы не регистрировались — просто проигнорируйте это письмо.</p>
    </div>
    """
    send_email(to_email, "Подтвердите email — FlowerFlip", html)

def send_reset_email(to_email: str, token: str, name: str):
    reset_url = f"{SITE_URL}/?reset_password={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0a18;color:#fff;border-radius:16px;">
      <h1 style="color:#ff3d8b;font-size:24px;margin-bottom:8px;">🌸 FlowerFlip</h1>
      <p style="color:#ccc;margin-bottom:8px;">Привет, {name}!</p>
      <p style="color:#ccc;margin-bottom:24px;">Поступил запрос на сброс пароля. Нажми кнопку ниже чтобы задать новый пароль.</p>
      <a href="{reset_url}" style="display:inline-block;background:linear-gradient(135deg,#ff3d8b,#a855f7);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:bold;font-size:16px;">Сбросить пароль</a>
      <p style="color:#555;font-size:12px;margin-top:24px;">Ссылка действительна 1 час. Если вы не запрашивали сброс — просто проигнорируйте.</p>
    </div>
    """
    send_email(to_email, "Сброс пароля — FlowerFlip", html)

def get_user_by_token(conn, token: str):
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name, u.phone, u.avatar_url, u.rating, u.reviews_count, "
            f"u.sales_count, u.purchases_count, u.balance, u.created_at, u.city, "
            f"u.is_admin, u.payout_method, u.payout_details, u.email, u.email_verified, "
            f"u.ref_code, u.ref_earnings "
            f"FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    if not row:
        return None
    cols = ["id","name","phone","avatar_url","rating","reviews_count","sales_count",
            "purchases_count","balance","created_at","city","is_admin","payout_method",
            "payout_details","email","email_verified","ref_code","ref_earnings"]
    d = dict(zip(cols, row))
    d["rating"] = float(d["rating"])
    d["balance"] = float(d["balance"])
    d["created_at"] = str(d["created_at"])
    d["is_admin"] = bool(d["is_admin"])
    d["email_verified"] = bool(d["email_verified"])
    d["ref_earnings"] = float(d["ref_earnings"] or 0)
    return d

def handler(event: dict, context) -> dict:
    """Авторизация пользователей FlowerFlip"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "")

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
        # ── REGISTER ──────────────────────────────────────────────
        if action == "register" and method == "POST":
            name = body.get("name", "").strip()
            phone = body.get("phone", "").strip()
            password = body.get("password", "")
            email = (body.get("email") or "").strip().lower() or None

            if not name or not phone or not password or not email:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заполните все поля (имя, телефон, email, пароль)"})}

            with conn.cursor() as cur:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE phone = %s", (phone,))
                if cur.fetchone():
                    return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Телефон уже зарегистрирован"})}
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
                if cur.fetchone():
                    return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Email уже зарегистрирован"})}

                city = body.get("city", "").strip() or None
                email_token = make_token()
                ref_input = (body.get("ref_code") or "").strip().upper() or None
                referrer_id = None
                if ref_input:
                    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE ref_code = %s", (ref_input,))
                    ref_row = cur.fetchone()
                    if ref_row:
                        referrer_id = ref_row[0]

                cur.execute(
                    f"INSERT INTO {SCHEMA}.users (name, phone, password_hash, city, email, email_token, email_token_at, referred_by) "
                    f"VALUES (%s, %s, %s, %s, %s, %s, NOW(), %s) RETURNING id",
                    (name, phone, hash_pwd(password), city, email, email_token, referrer_id)
                )
                user_id = cur.fetchone()[0]
                new_ref_code = secrets.token_hex(4).upper()
                cur.execute(f"UPDATE {SCHEMA}.users SET ref_code = %s WHERE id = %s", (new_ref_code, user_id))
                tok = make_token()
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)", (user_id, tok))
            conn.commit()
            send_verify_email(email, email_token, name)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"token": tok, "user": {"id": user_id, "name": name, "phone": phone}})}

        # ── LOGIN (телефон или email) ───────────────────────────────
        if action == "login" and method == "POST":
            login_id = (body.get("phone") or body.get("email") or "").strip().lower()
            password = body.get("password", "")
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, name, email_verified, email FROM {SCHEMA}.users "
                    f"WHERE (phone = %s OR email = %s) AND password_hash = %s",
                    (login_id, login_id, hash_pwd(password))
                )
                row = cur.fetchone()
            if not row:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Неверный телефон/email или пароль"})}
            if not row[2]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({
                    "error": "Email не подтверждён. Проверьте почту и перейдите по ссылке из письма.",
                    "email_not_verified": True,
                    "email": row[3]
                })}
            tok = make_token()
            with conn.cursor() as cur:
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)", (row[0], tok))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"token": tok, "user": {"id": row[0], "name": row[1]}})}

        # ── ME ────────────────────────────────────────────────────
        if action == "me" and method == "GET":
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            user = get_user_by_token(conn, token)
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Сессия истекла"})}
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"user": user})}

        # ── UPDATE PROFILE ────────────────────────────────────────
        if action == "update" and method == "POST":
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            user = get_user_by_token(conn, token)
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Сессия истекла"})}

            name = body.get("name")
            avatar_url = body.get("avatar_url")
            city = body.get("city")
            new_email = (body.get("email") or "").strip().lower() or None
            new_phone = (body.get("phone") or "").strip() or None

            with conn.cursor() as cur:
                if name:
                    cur.execute(f"UPDATE {SCHEMA}.users SET name = %s WHERE id = %s", (name, user["id"]))
                if avatar_url is not None:
                    cur.execute(f"UPDATE {SCHEMA}.users SET avatar_url = %s WHERE id = %s", (avatar_url, user["id"]))
                if city is not None:
                    cur.execute(f"UPDATE {SCHEMA}.users SET city = %s WHERE id = %s", (city, user["id"]))
                if new_phone and new_phone != user.get("phone"):
                    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE phone = %s AND id != %s", (new_phone, user["id"]))
                    if cur.fetchone():
                        return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Телефон уже используется"})}
                    cur.execute(f"UPDATE {SCHEMA}.users SET phone = %s WHERE id = %s", (new_phone, user["id"]))
                if new_email and new_email != user.get("email"):
                    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s AND id != %s", (new_email, user["id"]))
                    if cur.fetchone():
                        return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Email уже используется"})}
                    email_token = make_token()
                    cur.execute(
                        f"UPDATE {SCHEMA}.users SET email = %s, email_verified = FALSE, email_token = %s, email_token_at = NOW() WHERE id = %s",
                        (new_email, email_token, user["id"])
                    )
                    conn.commit()
                    send_verify_email(new_email, email_token, user["name"])
                    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "email_sent": True})}
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # ── CHANGE PASSWORD ───────────────────────────────────────
        if action == "change_password" and method == "POST":
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            user = get_user_by_token(conn, token)
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Сессия истекла"})}
            old_password = body.get("old_password", "")
            new_password = body.get("new_password", "")
            if not old_password or not new_password:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите старый и новый пароль"})}
            with conn.cursor() as cur:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE id = %s AND password_hash = %s", (user["id"], hash_pwd(old_password)))
                if not cur.fetchone():
                    return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Неверный текущий пароль"})}
                cur.execute(f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE id = %s", (hash_pwd(new_password), user["id"]))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # ── FORGOT PASSWORD (запрос сброса) ───────────────────────
        if action == "forgot_password" and method == "POST":
            email = (body.get("email") or "").strip().lower()
            if not email:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите email"})}
            with conn.cursor() as cur:
                cur.execute(f"SELECT id, name FROM {SCHEMA}.users WHERE email = %s", (email,))
                row = cur.fetchone()
            if not row:
                # Не раскрываем наличие email
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Если email зарегистрирован — письмо отправлено"})}
            reset_token = make_token()
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET reset_token = %s, reset_token_at = NOW() WHERE id = %s",
                    (reset_token, row[0])
                )
            conn.commit()
            send_reset_email(email, reset_token, row[1])
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Если email зарегистрирован — письмо отправлено"})}

        # ── RESET PASSWORD (установка нового пароля по токену) ────
        if action == "reset_password" and method == "POST":
            reset_token = body.get("token", "")
            new_password = body.get("password", "")
            if not reset_token or not new_password:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Неверные данные"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.users WHERE reset_token = %s "
                    f"AND reset_token_at > NOW() - INTERVAL '1 hour'",
                    (reset_token,)
                )
                row = cur.fetchone()
            if not row:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Ссылка недействительна или истекла"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET password_hash = %s, reset_token = NULL WHERE id = %s",
                    (hash_pwd(new_password), row[0])
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Пароль успешно изменён"})}

        # ── VERIFY EMAIL ──────────────────────────────────────────
        if action == "verify_email":
            verify_token = qs.get("token") or body.get("token", "")
            if not verify_token:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Токен не указан"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, name FROM {SCHEMA}.users WHERE email_token = %s "
                    f"AND email_token_at > NOW() - INTERVAL '24 hours'",
                    (verify_token,)
                )
                row = cur.fetchone()
            if not row:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Ссылка недействительна или истекла"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET email_verified = TRUE, email_token = NULL WHERE id = %s",
                    (row[0],)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Email подтверждён!"})}

        # ── RESEND VERIFY ─────────────────────────────────────────
        if action == "resend_verify" and method == "POST":
            email_input = (body.get("email") or "").strip().lower()
            # Если передан email — ищем по нему (для случая когда токена ещё нет)
            if email_input:
                with conn.cursor() as cur:
                    cur.execute(
                        f"SELECT id, name, email, email_verified FROM {SCHEMA}.users WHERE email = %s",
                        (email_input,)
                    )
                    urow = cur.fetchone()
                if not urow:
                    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}
                if urow[3]:
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Email уже подтверждён"})}
                email_token = make_token()
                with conn.cursor() as cur:
                    cur.execute(
                        f"UPDATE {SCHEMA}.users SET email_token = %s, email_token_at = NOW() WHERE id = %s",
                        (email_token, urow[0])
                    )
                conn.commit()
                send_verify_email(urow[2], email_token, urow[1])
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}
            # Иначе — по токену авторизации
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            user = get_user_by_token(conn, token)
            if not user or not user.get("email"):
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Email не указан"})}
            if user.get("email_verified"):
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Email уже подтверждён"})}
            email_token = make_token()
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET email_token = %s, email_token_at = NOW() WHERE id = %s",
                    (email_token, user["id"])
                )
            conn.commit()
            send_verify_email(user["email"], email_token, user["name"])
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # ── LOGOUT ────────────────────────────────────────────────
        if action == "logout" and method == "POST":
            if token:
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token = %s", (token,))
                conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()