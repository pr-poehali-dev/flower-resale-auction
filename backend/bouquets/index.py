"""Аукционы и каталог: список, детали, создание букета, ставка, избранное"""
import json
import os
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

def send_bid_notification(seller_email: str, seller_name: str, bouquet_title: str, bidder_name: str, amount: float):
    """Отправляет продавцу уведомление о новой ставке"""
    smtp_password = os.environ.get("SMTP_PASSWORD", "")
    if not smtp_password or not seller_email:
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🌸 Новая ставка на «{bouquet_title}» — FlowerFlip"
    msg["From"] = f"FlowerFlip <{SITE_EMAIL}>"
    msg["To"] = seller_email
    amount_str = f"{amount:,.0f}".replace(",", " ")
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0a18;color:#fff;border-radius:16px;">
      <h1 style="color:#ff3d8b;font-size:22px;margin-bottom:4px;">🌸 FlowerFlip</h1>
      <p style="color:#aaa;font-size:13px;margin-top:0">Аукцион букетов</p>
      <div style="background:rgba(255,61,139,0.1);border:1px solid rgba(255,61,139,0.3);border-radius:12px;padding:20px;margin:20px 0;">
        <p style="color:#fff;font-size:16px;margin:0 0 8px">Привет, {seller_name}!</p>
        <p style="color:#ccc;margin:0">На ваш букет <strong style="color:#ff3d8b">«{bouquet_title}»</strong> сделана новая ставка</p>
      </div>
      <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="color:#aaa;font-size:12px;margin:0 0 4px">СУММА СТАВКИ</p>
        <p style="color:#ff3d8b;font-size:28px;font-weight:bold;margin:0">{amount_str} ₽</p>
        <p style="color:#777;font-size:13px;margin:8px 0 0">Покупатель: {bidder_name}</p>
      </div>
      <a href="{SITE_URL}" style="display:inline-block;background:linear-gradient(135deg,#ff3d8b,#a855f7);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:bold;font-size:15px;">Перейти на сайт →</a>
      <p style="color:#444;font-size:11px;margin-top:24px;">Вы получили это письмо потому что являетесь продавцом на FlowerFlip</p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("mail.hosting.reg.ru", 465, context=context) as server:
            server.login(SITE_EMAIL, smtp_password)
            server.sendmail(SITE_EMAIL, seller_email, msg.as_string())
    except Exception as e:
        print(f"[SMTP BID ERROR] {e}")

def finalize_expired_auctions(conn):
    """Автозавершение аукционов, у которых истекло время.
    Со ставками -> 'won' (победитель: автор макс. ставки). Без ставок -> 'expired'."""
    with conn.cursor() as cur:
        # Со ставками -> won + создаём заказ победителю, если его ещё нет
        cur.execute(
            f"SELECT b.id, b.current_price, b.seller_id, "
            f"(SELECT user_id FROM {SCHEMA}.bids WHERE bouquet_id = b.id ORDER BY amount DESC, created_at ASC LIMIT 1) as winner_id "
            f"FROM {SCHEMA}.bouquets b "
            f"WHERE b.status = 'active' AND b.ends_at <= NOW()"
        )
        expired = cur.fetchall()
        for bid, price, seller_id, winner_id in expired:
            if winner_id:
                cur.execute(f"UPDATE {SCHEMA}.bouquets SET status = 'won' WHERE id = %s", (bid,))
                # Создаём заказ победителю, если ещё не создан
                cur.execute(f"SELECT id FROM {SCHEMA}.orders WHERE bouquet_id = %s", (bid,))
                if not cur.fetchone():
                    amount = float(price)
                    commission = round(amount * 0.12, 2)
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.orders (bouquet_id, buyer_id, seller_id, amount, commission, escrow_status) "
                        f"VALUES (%s, %s, %s, %s, %s, 'waiting_payment')",
                        (bid, winner_id, seller_id, amount, commission)
                    )
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.messages (sender_id, receiver_id, text, bouquet_id) "
                        f"VALUES (%s, %s, %s, %s)",
                        (seller_id, winner_id,
                         "🎉 Поздравляем! Вы выиграли аукцион. Оплатите заказ во вкладке «Сделки», чтобы получить контакты продавца.",
                         bid)
                    )
            else:
                cur.execute(f"UPDATE {SCHEMA}.bouquets SET status = 'expired' WHERE id = %s", (bid,))
    conn.commit()


def get_user_by_token(conn, token: str):
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

def row_to_bouquet(row, cols):
    d = dict(zip(cols, row))
    for f in ["start_price", "current_price", "min_step"]:
        if d.get(f) is not None:
            d[f] = float(d[f])
    if d.get("ends_at"):
        d["ends_at"] = str(d["ends_at"])
    if d.get("created_at"):
        d["created_at"] = str(d["created_at"])
    if d.get("seller_rating") is not None:
        d["seller_rating"] = float(d["seller_rating"])
    if d.get("liked") is None:
        d["liked"] = False
    return d

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "list")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        finalize_expired_auctions(conn)
        user = get_user_by_token(conn, token)

        # GET list — активные аукционы
        if action == "list":
            status = qs.get("status", "active")
            tag = qs.get("tag")
            sort = qs.get("sort", "ends_at")
            max_price = qs.get("max_price")

            conditions = [f"b.status = %s"]
            params = [status]

            if tag and tag != "все":
                conditions.append(f"%s = ANY(b.flowers)")
                params.append(tag)
            if max_price:
                conditions.append(f"b.current_price <= %s")
                params.append(float(max_price))

            order_map = {"ends_at": "b.ends_at ASC", "price": "b.current_price ASC", "rating": "u.rating DESC"}
            order = order_map.get(sort, "b.ends_at ASC")
            where_sql = " AND ".join(conditions)

            if user:
                fav_col = f"EXISTS(SELECT 1 FROM {SCHEMA}.favorites f WHERE f.bouquet_id = b.id AND f.user_id = {user['id']}) as liked"
            else:
                fav_col = "false as liked"

            city_filter = qs.get("city")
            district_filter = qs.get("district")
            if city_filter:
                conditions.append("b.city = %s")
                params.append(city_filter)
            if district_filter:
                conditions.append("b.district = %s")
                params.append(district_filter)
            where_sql = " AND ".join(conditions)

            cols = ["id","seller_id","seller_name","seller_rating","title","description","flowers",
                    "freshness","image_urls","start_price","current_price","min_step","bids_count",
                    "status","ends_at","created_at","liked","city","district","meet_point"]
            sql = (
                f"SELECT b.id, b.seller_id, u.name, u.rating, "
                f"b.title, b.description, b.flowers, b.freshness, b.image_urls, "
                f"b.start_price, b.current_price, b.min_step, b.bids_count, b.status, b.ends_at, b.created_at, "
                f"{fav_col}, b.city, b.district, b.meet_point "
                f"FROM {SCHEMA}.bouquets b "
                f"JOIN {SCHEMA}.users u ON u.id = b.seller_id "
                f"WHERE {where_sql} "
                f"ORDER BY {order} LIMIT 50"
            )
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"bouquets": [row_to_bouquet(r, cols) for r in rows]})}

        # GET detail
        if action == "detail":
            bid = qs.get("id")
            if not bid:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "id required"})}
            if user:
                fav_col = f"EXISTS(SELECT 1 FROM {SCHEMA}.favorites f WHERE f.bouquet_id = b.id AND f.user_id = {user['id']}) as liked"
            else:
                fav_col = "false as liked"
            cols = ["id","seller_id","seller_name","seller_rating","title","description","flowers",
                    "freshness","image_urls","start_price","current_price","min_step","bids_count",
                    "status","ends_at","created_at","liked","city","district","meet_point"]
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT b.id, b.seller_id, u.name, u.rating, b.title, b.description, b.flowers, "
                    f"b.freshness, b.image_urls, b.start_price, b.current_price, b.min_step, b.bids_count, "
                    f"b.status, b.ends_at, b.created_at, {fav_col}, b.city, b.district, b.meet_point "
                    f"FROM {SCHEMA}.bouquets b JOIN {SCHEMA}.users u ON u.id = b.seller_id "
                    f"WHERE b.id = %s", (bid,)
                )
                row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Не найден"})}
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"bouquet": row_to_bouquet(row, cols)})}

        # POST create
        if action == "create" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            title = body.get("title", "").strip()
            flowers = body.get("flowers", [])
            freshness = body.get("freshness", "сегодня")
            image_urls = body.get("image_urls", [])
            start_price = float(body.get("start_price", 500))
            duration_hours = int(body.get("duration_hours", 3))
            description = body.get("description", "")
            city = body.get("city", "").strip() or None
            district = body.get("district", "").strip() or None
            meet_point = body.get("meet_point", "").strip() or None
            if not title:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите название"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.bouquets "
                    f"(seller_id, title, description, flowers, freshness, image_urls, start_price, current_price, ends_at, city, district, meet_point) "
                    f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW() + INTERVAL '{duration_hours} hours', %s, %s, %s) "
                    f"RETURNING id",
                    (user["id"], title, description, flowers, freshness, image_urls, start_price, start_price, city, district, meet_point)
                )
                new_id = cur.fetchone()[0]
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET sales_count = sales_count + 1 WHERE id = %s",
                    (user["id"],)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"id": new_id})}

        # POST bid
        if action == "bid" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            bouquet_id = int(body.get("bouquet_id", 0))
            amount = float(body.get("amount", 0))
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT b.current_price, b.min_step, b.status, b.seller_id, b.title, "
                    f"u.email, u.name "
                    f"FROM {SCHEMA}.bouquets b "
                    f"JOIN {SCHEMA}.users u ON u.id = b.seller_id "
                    f"WHERE b.id = %s",
                    (bouquet_id,)
                )
                b = cur.fetchone()
            if not b:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Букет не найден"})}
            if b[2] != "active":
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Аукцион завершён"})}
            if b[3] == user["id"]:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нельзя ставить на свой букет"})}
            min_bid = float(b[0]) + float(b[1])
            if amount < min_bid:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": f"Минимальная ставка {min_bid} ₽"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.bids (bouquet_id, user_id, amount) VALUES (%s, %s, %s)",
                    (bouquet_id, user["id"], amount)
                )
                cur.execute(
                    f"UPDATE {SCHEMA}.bouquets SET current_price = %s, bids_count = bids_count + 1 WHERE id = %s",
                    (amount, bouquet_id)
                )
            conn.commit()
            # Уведомляем продавца по email (не блокирует ответ)
            seller_email, seller_name, bouquet_title = b[5], b[6], b[4]
            send_bid_notification(seller_email, seller_name, bouquet_title, user["name"], amount)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "new_price": amount})}

        # POST favorite
        if action == "favorite" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            bouquet_id = int(body.get("bouquet_id", 0))
            add = body.get("add", True)
            with conn.cursor() as cur:
                if add:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.favorites (user_id, bouquet_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (user["id"], bouquet_id)
                    )
                else:
                    cur.execute(
                        f"UPDATE {SCHEMA}.favorites SET user_id = %s WHERE user_id = %s AND bouquet_id = %s",
                        (user["id"], user["id"], bouquet_id)
                    )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # GET favorites
        if action == "favorites":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            cols = ["id","seller_id","seller_name","seller_rating","title","description","flowers",
                    "freshness","image_urls","start_price","current_price","min_step","bids_count",
                    "status","ends_at","created_at","liked"]
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT b.id, b.seller_id, u.name, u.rating, b.title, b.description, b.flowers, "
                    f"b.freshness, b.image_urls, b.start_price, b.current_price, b.min_step, b.bids_count, "
                    f"b.status, b.ends_at, b.created_at, true as liked "
                    f"FROM {SCHEMA}.favorites fv "
                    f"JOIN {SCHEMA}.bouquets b ON b.id = fv.bouquet_id "
                    f"JOIN {SCHEMA}.users u ON u.id = b.seller_id "
                    f"WHERE fv.user_id = %s ORDER BY b.ends_at ASC",
                    (user["id"],)
                )
                rows = cur.fetchall()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"bouquets": [row_to_bouquet(r, cols) for r in rows]})}

        # POST cancel — продавец снимает свой букет с аукциона
        if action == "cancel" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            bouquet_id = int(body.get("bouquet_id", 0))
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT seller_id, status, bids_count FROM {SCHEMA}.bouquets WHERE id = %s",
                    (bouquet_id,)
                )
                row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Букет не найден"})}
            if row[0] != user["id"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Это не ваш букет"})}
            if row[1] != "active":
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Снять можно только активный аукцион"})}
            if row[2] > 0:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нельзя снять букет, на который уже есть ставки"})}
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.bouquets SET status = 'cancelled' WHERE id = %s", (bouquet_id,))
                cur.execute(f"UPDATE {SCHEMA}.users SET sales_count = GREATEST(sales_count - 1, 0) WHERE id = %s", (user["id"],))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()