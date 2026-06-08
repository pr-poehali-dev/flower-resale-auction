"""Профиль: заказы, мои продажи, отзывы, чаты, сообщения, вывод средств"""
import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def get_user_by_token(conn, token: str):
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name, u.balance FROM {SCHEMA}.sessions s "
            f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    return {"id": row[0], "name": row[1], "balance": float(row[2])} if row else None

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        user = get_user_by_token(conn, token)

        if action == "orders":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT o.id, o.amount, o.status, o.created_at, o.updated_at, "
                    f"b.title, b.image_urls, s.name, s.id "
                    f"FROM {SCHEMA}.orders o "
                    f"JOIN {SCHEMA}.bouquets b ON b.id = o.bouquet_id "
                    f"JOIN {SCHEMA}.users s ON s.id = o.seller_id "
                    f"WHERE o.buyer_id = %s ORDER BY o.created_at DESC",
                    (user["id"],)
                )
                rows = cur.fetchall()
            orders = [{"id": r[0], "amount": float(r[1]), "status": r[2],
                       "created_at": str(r[3]), "updated_at": str(r[4]),
                       "title": r[5], "image_urls": r[6] or [],
                       "seller_name": r[7], "seller_id": r[8]} for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"orders": orders})}

        if action == "my_sales":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT b.id, b.title, b.current_price, b.status, b.ends_at, b.bids_count, b.image_urls "
                    f"FROM {SCHEMA}.bouquets b WHERE b.seller_id = %s ORDER BY b.created_at DESC LIMIT 20",
                    (user["id"],)
                )
                rows = cur.fetchall()
            sales = [{"id": r[0], "title": r[1], "current_price": float(r[2]),
                      "status": r[3], "ends_at": str(r[4]),
                      "bids_count": r[5], "image_urls": r[6] or []} for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"sales": sales})}

        if action == "reviews":
            uid = qs.get("user_id") or (user["id"] if user else None)
            if not uid:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_id required"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT r.id, r.stars, r.text, r.created_at, u.name "
                    f"FROM {SCHEMA}.reviews r JOIN {SCHEMA}.users u ON u.id = r.reviewer_id "
                    f"WHERE r.target_id = %s ORDER BY r.created_at DESC LIMIT 20",
                    (uid,)
                )
                rows = cur.fetchall()
            reviews = [{"id": r[0], "stars": r[1], "text": r[2], "created_at": str(r[3]), "reviewer_name": r[4]} for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"reviews": reviews})}

        if action == "chats":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            uid = user["id"]
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT DISTINCT ON (LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id)) "
                    f"m.text, m.created_at, m.bouquet_id, "
                    f"CASE WHEN m.sender_id = %s THEN m.receiver_id ELSE m.sender_id END as other_id, "
                    f"CASE WHEN m.sender_id = %s THEN u2.name ELSE u1.name END as other_name, "
                    f"b.title "
                    f"FROM {SCHEMA}.messages m "
                    f"JOIN {SCHEMA}.users u1 ON u1.id = m.sender_id "
                    f"JOIN {SCHEMA}.users u2 ON u2.id = m.receiver_id "
                    f"LEFT JOIN {SCHEMA}.bouquets b ON b.id = m.bouquet_id "
                    f"WHERE m.sender_id = %s OR m.receiver_id = %s "
                    f"ORDER BY LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id), m.created_at DESC",
                    (uid, uid, uid, uid)
                )
                rows = cur.fetchall()
            chats = []
            for r in rows:
                with conn.cursor() as c2:
                    c2.execute(
                        f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE receiver_id = %s AND sender_id = %s AND is_read = false",
                        (uid, r[3])
                    )
                    unread = c2.fetchone()[0]
                chats.append({"last_message": r[0], "created_at": str(r[1]),
                              "bouquet_id": r[2], "other_id": r[3],
                              "other_name": r[4], "bouquet_title": r[5], "unread": unread})
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"chats": chats})}

        if action == "messages":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            other_id = qs.get("other_id")
            if not other_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "other_id required"})}
            uid = user["id"]
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT m.id, m.sender_id, m.text, m.created_at, m.is_read "
                    f"FROM {SCHEMA}.messages m "
                    f"WHERE (m.sender_id = %s AND m.receiver_id = %s) OR (m.sender_id = %s AND m.receiver_id = %s) "
                    f"ORDER BY m.created_at ASC LIMIT 100",
                    (uid, other_id, other_id, uid)
                )
                rows = cur.fetchall()
                cur.execute(
                    f"UPDATE {SCHEMA}.messages SET is_read = true WHERE receiver_id = %s AND sender_id = %s",
                    (uid, other_id)
                )
            conn.commit()
            msgs = [{"id": r[0], "sender_id": r[1], "text": r[2], "created_at": str(r[3]), "is_read": r[4]} for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"messages": msgs})}

        if action == "send_message" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            receiver_id = int(body.get("receiver_id", 0))
            text = body.get("text", "").strip()
            bouquet_id = body.get("bouquet_id")
            if not text or not receiver_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите получателя и текст"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.messages (sender_id, receiver_id, text, bouquet_id) "
                    f"VALUES (%s, %s, %s, %s) RETURNING id, created_at",
                    (user["id"], receiver_id, text, bouquet_id)
                )
                row = cur.fetchone()
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"id": row[0], "created_at": str(row[1])})}

        if action == "withdraw" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            amount = float(body.get("amount", 0))
            withdraw_method = body.get("method", "card")
            if amount <= 0:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите сумму"})}
            if amount > user["balance"]:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Недостаточно средств"})}
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.users SET balance = balance - %s WHERE id = %s", (amount, user["id"]))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": f"Заявка на вывод {amount:.0f} ₽ через {withdraw_method} принята"})}

        if action == "add_review" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            target_id = int(body.get("target_id", 0))
            stars = int(body.get("stars", 5))
            text = body.get("text", "")
            order_id = body.get("order_id")
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.reviews (reviewer_id, target_id, order_id, stars, text) VALUES (%s, %s, %s, %s, %s)",
                    (user["id"], target_id, order_id, stars, text)
                )
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET "
                    f"rating = (SELECT AVG(stars) FROM {SCHEMA}.reviews WHERE target_id = %s), "
                    f"reviews_count = reviews_count + 1 WHERE id = %s",
                    (target_id, target_id)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()