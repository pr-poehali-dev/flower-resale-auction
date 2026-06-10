"""v2
Эскроу-система безопасной передачи букетов.

Схема:
1. После победы в аукционе → создаётся заказ (escrow_status=waiting_payment)
2. Покупатель "оплачивает" → деньги замораживаются на балансе, статус=paid
   Продавцу открывается номер телефона покупателя, покупателю — продавца
   Чат между ними активируется
3. Покупатель получил букет → нажимает "Подтвердить получение" → статус=completed
   Деньги (минус комиссия 12%) переходят продавцу
4. Если покупатель не подтвердил в течение 48ч → авто-подтверждение
5. Спор: покупатель нажимает "Проблема" → статус=dispute → разбор модератором

Защита от мошенничества:
- Деньги заморожены у платформы до подтверждения получения
- Покупатель не может отменить после оплаты (только через спор)
- Продавец получает деньги только после подтверждения или 48ч
- Телефоны видны обеим сторонам только после оплаты
- История переписки сохраняется
"""
import json
import os
import psycopg2
from datetime import datetime, timedelta

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
COMMISSION = 0.15        # 15% — комиссия платформы
YOOKASSA_FEE = 0.055    # 5.5% — комиссия ЮКассы (вычитается из поступившей суммы)
AUTO_CONFIRM_HOURS = 48

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
            f"SELECT u.id, u.name, u.phone, u.balance, u.email_verified "
            f"FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "name": row[1], "phone": row[2], "balance": float(row[3]), "email_verified": bool(row[4])}

def fmt_order(row, cols):
    d = dict(zip(cols, row))
    for f in ["amount", "commission"]:
        if d.get(f) is not None:
            d[f] = float(d[f])
    for f in ["created_at", "updated_at", "buyer_confirmed_at", "auto_confirm_at"]:
        if d.get(f) is not None:
            d[f] = str(d[f])
    return d

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
        user = get_user(conn, token)

        # Создать заказ после победы в аукционе
        if action == "create_order" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            bouquet_id = int(body.get("bouquet_id", 0))
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, seller_id, current_price, status, title FROM {SCHEMA}.bouquets WHERE id = %s",
                    (bouquet_id,)
                )
                b = cur.fetchone()
            if not b:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Букет не найден"})}
            if b[3] != "won":
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Аукцион ещё не завершён"})}
            if b[1] == user["id"]:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нельзя купить свой букет"})}

            amount = float(b[2])
            # Из суммы вычитаем комиссию ЮКассы, затем берём комиссию платформы от остатка
            yookassa_fee = round(amount * YOOKASSA_FEE, 2)
            net_after_yookassa = round(amount - yookassa_fee, 2)
            platform_commission = round(net_after_yookassa * COMMISSION, 2)
            commission = round(yookassa_fee + platform_commission, 2)  # итоговая комиссия в заказе

            with conn.cursor() as cur:
                # Проверяем нет ли уже заказа
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.orders WHERE bouquet_id = %s",
                    (bouquet_id,)
                )
                if cur.fetchone():
                    return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Заказ уже создан"})}
                cur.execute(
                    f"INSERT INTO {SCHEMA}.orders (bouquet_id, buyer_id, seller_id, amount, commission, escrow_status) "
                    f"VALUES (%s, %s, %s, %s, %s, 'waiting_payment') RETURNING id",
                    (bouquet_id, user["id"], b[1], amount, commission)
                )
                order_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"order_id": order_id, "amount": amount, "commission": commission})}

        # Оплатить заказ (деньги замораживаются)
        if action == "pay" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            if not user.get("email_verified"):
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Подтвердите email перед оплатой", "email_not_verified": True})}
            order_id = int(body.get("order_id", 0))
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT o.id, o.amount, o.escrow_status, o.buyer_id, o.seller_id, "
                    f"b.title, s.phone as seller_phone, buy.phone as buyer_phone "
                    f"FROM {SCHEMA}.orders o "
                    f"JOIN {SCHEMA}.bouquets b ON b.id = o.bouquet_id "
                    f"JOIN {SCHEMA}.users s ON s.id = o.seller_id "
                    f"JOIN {SCHEMA}.users buy ON buy.id = o.buyer_id "
                    f"WHERE o.id = %s", (order_id,)
                )
                order = cur.fetchone()
            if not order:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заказ не найден"})}
            if order[3] != user["id"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}
            if order[2] != "waiting_payment":
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заказ уже оплачен или завершён"})}

            amount = float(order[1])
            if user["balance"] < amount:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": f"Недостаточно средств. Нужно {amount} ₽, у вас {user['balance']} ₽"})}

            auto_confirm = datetime.now() + timedelta(hours=AUTO_CONFIRM_HOURS)
            with conn.cursor() as cur:
                # Списываем деньги с покупателя (они "заморожены" в системе)
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET balance = balance - %s WHERE id = %s",
                    (amount, user["id"])
                )
                # Открываем телефоны обеим сторонам
                cur.execute(
                    f"UPDATE {SCHEMA}.orders SET escrow_status = 'paid', seller_phone_revealed = true, "
                    f"auto_confirm_at = %s, updated_at = NOW() WHERE id = %s",
                    (auto_confirm, order_id)
                )
                # Автоматически создаём чат между ними о букете
                cur.execute(
                    f"INSERT INTO {SCHEMA}.messages (sender_id, receiver_id, text, bouquet_id) "
                    f"VALUES (%s, %s, %s, (SELECT bouquet_id FROM {SCHEMA}.orders WHERE id = %s))",
                    (user["id"], order[4],
                     f"Привет! Я оплатил(а) заказ на '{order[5]}'. Давайте договоримся о встрече для передачи.",
                     order_id)
                )
                # Реферальное начисление 5% от суммы покупателю-рефереру
                cur.execute(f"SELECT referred_by FROM {SCHEMA}.users WHERE id = %s", (user["id"],))
                ref_row = cur.fetchone()
                if ref_row and ref_row[0]:
                    referrer_id = ref_row[0]
                    ref_bonus = round(amount * 0.05)
                    if ref_bonus > 0:
                        cur.execute(
                            f"UPDATE {SCHEMA}.users SET balance = balance + %s, ref_earnings = ref_earnings + %s WHERE id = %s",
                            (ref_bonus, ref_bonus, referrer_id)
                        )
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.referral_payouts (referrer_id, referee_id, order_id, amount) "
                            f"VALUES (%s, %s, %s, %s)",
                            (referrer_id, user["id"], order_id, ref_bonus)
                        )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "ok": True,
                "seller_phone": order[6],
                "message": "Оплата принята. Телефон продавца открыт — договоритесь о встрече!"
            })}

        # Получить детали заказа с контактами (если оплачен)
        if action == "order_detail":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            order_id = int(qs.get("id", 0))
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT o.id, o.amount, o.commission, o.escrow_status, o.created_at, o.updated_at, "
                    f"o.buyer_confirmed_at, o.auto_confirm_at, o.dispute_reason, o.seller_phone_revealed, "
                    f"b.title, b.image_urls, b.city, b.district, b.meet_point, "
                    f"s.name as seller_name, s.id as seller_id, "
                    f"buy.name as buyer_name, buy.id as buyer_id, "
                    f"CASE WHEN o.seller_phone_revealed THEN s.phone ELSE NULL END as seller_phone, "
                    f"CASE WHEN o.seller_phone_revealed THEN buy.phone ELSE NULL END as buyer_phone "
                    f"FROM {SCHEMA}.orders o "
                    f"JOIN {SCHEMA}.bouquets b ON b.id = o.bouquet_id "
                    f"JOIN {SCHEMA}.users s ON s.id = o.seller_id "
                    f"JOIN {SCHEMA}.users buy ON buy.id = o.buyer_id "
                    f"WHERE o.id = %s AND (o.buyer_id = %s OR o.seller_id = %s)",
                    (order_id, user["id"], user["id"])
                )
                row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заказ не найден"})}
            cols = ["id","amount","commission","escrow_status","created_at","updated_at",
                    "buyer_confirmed_at","auto_confirm_at","dispute_reason","seller_phone_revealed",
                    "title","image_urls","city","district","meet_point",
                    "seller_name","seller_id","buyer_name","buyer_id","seller_phone","buyer_phone"]
            d = fmt_order(row, cols)
            d["is_buyer"] = user["id"] == d["buyer_id"]
            d["is_seller"] = user["id"] == d["seller_id"]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"order": d})}

        # Покупатель подтверждает получение
        if action == "confirm" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            order_id = int(body.get("order_id", 0))
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT o.amount, o.commission, o.escrow_status, o.buyer_id, o.seller_id "
                    f"FROM {SCHEMA}.orders o WHERE o.id = %s", (order_id,)
                )
                order = cur.fetchone()
            if not order:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заказ не найден"})}
            if order[3] != user["id"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Только покупатель может подтвердить"})}
            if order[2] not in ("paid",):
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заказ уже завершён или в споре"})}

            amount = float(order[0])
            commission = float(order[1])
            seller_gets = round(amount - commission, 2)

            with conn.cursor() as cur:
                # Деньги продавцу (минус комиссия)
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET balance = balance + %s, sales_count = sales_count + 1 WHERE id = %s",
                    (seller_gets, order[4])
                )
                # Комиссия платформы зачисляется на счёт платформы
                cur.execute(
                    f"INSERT INTO {SCHEMA}.platform_earnings (order_id, amount) VALUES (%s, %s)",
                    (order_id, commission)
                )
                cur.execute(
                    f"UPDATE {SCHEMA}.orders SET escrow_status = 'completed', "
                    f"buyer_confirmed_at = NOW(), updated_at = NOW() WHERE id = %s",
                    (order_id,)
                )
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET purchases_count = purchases_count + 1 WHERE id = %s",
                    (user["id"],)
                )
                # Уведомление продавцу в чат
                cur.execute(
                    f"INSERT INTO {SCHEMA}.messages (sender_id, receiver_id, text, bouquet_id) "
                    f"VALUES (%s, %s, %s, (SELECT bouquet_id FROM {SCHEMA}.orders WHERE id = %s))",
                    (user["id"], order[4],
                     f"✅ Я подтвердил(а) получение букета. Спасибо за сделку! Деньги ({seller_gets} ₽) отправлены вам.",
                     order_id)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "ok": True,
                "message": f"Получение подтверждено! Продавец получил {seller_gets} ₽"
            })}

        # Покупатель открывает спор
        if action == "dispute" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            order_id = int(body.get("order_id", 0))
            reason = body.get("reason", "").strip()
            if not reason:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите причину спора"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT escrow_status, buyer_id FROM {SCHEMA}.orders WHERE id = %s", (order_id,)
                )
                row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заказ не найден"})}
            if row[1] != user["id"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}
            if row[0] != "paid":
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нельзя открыть спор в данном статусе"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.orders SET escrow_status = 'dispute', dispute_reason = %s, updated_at = NOW() WHERE id = %s",
                    (reason, order_id)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "ok": True,
                "message": "Спор открыт. Служба поддержки свяжется с вами в течение 24 часов."
            })}

        # Мои активные сделки (покупатель или продавец)
        if action == "my_deals":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT o.id, o.amount, o.commission, o.escrow_status, o.created_at, o.updated_at, "
                    f"o.seller_phone_revealed, o.auto_confirm_at, o.dispute_reason, "
                    f"b.title, b.image_urls, b.city, b.district, "
                    f"s.name as seller_name, s.id as seller_id, "
                    f"buy.name as buyer_name, buy.id as buyer_id, "
                    f"CASE WHEN o.seller_phone_revealed THEN s.phone ELSE NULL END as seller_phone, "
                    f"CASE WHEN o.seller_phone_revealed THEN buy.phone ELSE NULL END as buyer_phone, "
                    f"CASE WHEN o.seller_phone_revealed THEN s.email ELSE NULL END as seller_email, "
                    f"CASE WHEN o.seller_phone_revealed THEN buy.email ELSE NULL END as buyer_email "
                    f"FROM {SCHEMA}.orders o "
                    f"JOIN {SCHEMA}.bouquets b ON b.id = o.bouquet_id "
                    f"JOIN {SCHEMA}.users s ON s.id = o.seller_id "
                    f"JOIN {SCHEMA}.users buy ON buy.id = o.buyer_id "
                    f"WHERE (o.buyer_id = %s OR o.seller_id = %s) "
                    f"ORDER BY o.updated_at DESC LIMIT 20",
                    (user["id"], user["id"])
                )
                rows = cur.fetchall()
            cols = ["id","amount","commission","escrow_status","created_at","updated_at",
                    "seller_phone_revealed","auto_confirm_at","dispute_reason",
                    "title","image_urls","city","district",
                    "seller_name","seller_id","buyer_name","buyer_id",
                    "seller_phone","buyer_phone","seller_email","buyer_email"]
            deals = []
            for row in rows:
                d = fmt_order(row, cols)
                d["is_buyer"] = user["id"] == d["buyer_id"]
                d["is_seller"] = user["id"] == d["seller_id"]
                deals.append(d)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"deals": deals})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()