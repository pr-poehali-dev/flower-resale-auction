"""Аукционы и каталог: список, детали, создание букета, ставка, избранное"""
import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

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
    action = qs.get("action", "list")
    body = json.loads(event.get("body") or "{}")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
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
                    f"SELECT current_price, min_step, status, seller_id FROM {SCHEMA}.bouquets WHERE id = %s",
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

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()