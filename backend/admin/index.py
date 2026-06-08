"""Админ-панель: заявки на вывод средств, подтверждение/отклонение, статистика комиссии"""
import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_admin(conn, token: str):
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name, u.is_admin FROM {SCHEMA}.sessions s "
            f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    if not row or not row[2]:
        return None
    return {"id": row[0], "name": row[1]}


def handler(event: dict, context) -> dict:
    """Управление выводами и статистикой для администратора платформы"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        admin = get_admin(conn, token)
        if not admin:
            return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Доступ только для администратора"})}

        # Список заявок на вывод (с фильтром по статусу)
        if action == "withdrawals":
            status_filter = qs.get("status", "")
            where = ""
            params = []
            if status_filter:
                where = "WHERE w.status = %s"
                params.append(status_filter)
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT w.id, w.amount, w.method, w.details, w.status, w.admin_comment, "
                    f"w.created_at, w.processed_at, u.id, u.name, u.phone "
                    f"FROM {SCHEMA}.withdrawals w "
                    f"JOIN {SCHEMA}.users u ON u.id = w.user_id "
                    f"{where} ORDER BY w.created_at DESC LIMIT 100",
                    tuple(params)
                )
                rows = cur.fetchall()
            items = [{"id": r[0], "amount": float(r[1]), "method": r[2], "details": r[3],
                      "status": r[4], "admin_comment": r[5],
                      "created_at": str(r[6]), "processed_at": str(r[7]) if r[7] else None,
                      "user_id": r[8], "user_name": r[9], "user_phone": r[10]} for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"withdrawals": items})}

        # Подтвердить вывод (деньги уже списаны при создании заявки — просто помечаем выплаченным)
        if action == "approve" and method == "POST":
            wid = int(body.get("withdrawal_id", 0))
            comment = body.get("comment", "")
            with conn.cursor() as cur:
                cur.execute(f"SELECT status FROM {SCHEMA}.withdrawals WHERE id = %s", (wid,))
                row = cur.fetchone()
                if not row:
                    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заявка не найдена"})}
                if row[0] != "pending":
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заявка уже обработана"})}
                cur.execute(
                    f"UPDATE {SCHEMA}.withdrawals SET status = 'paid', admin_comment = %s, "
                    f"processed_by = %s, processed_at = NOW() WHERE id = %s",
                    (comment, admin["id"], wid)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Вывод подтверждён"})}

        # Отклонить вывод (возвращаем деньги на баланс пользователя)
        if action == "reject" and method == "POST":
            wid = int(body.get("withdrawal_id", 0))
            comment = body.get("comment", "")
            with conn.cursor() as cur:
                cur.execute(f"SELECT status, user_id, amount FROM {SCHEMA}.withdrawals WHERE id = %s", (wid,))
                row = cur.fetchone()
                if not row:
                    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заявка не найдена"})}
                if row[0] != "pending":
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заявка уже обработана"})}
                # Возвращаем замороженные деньги обратно
                cur.execute(f"UPDATE {SCHEMA}.users SET balance = balance + %s WHERE id = %s", (row[2], row[1]))
                cur.execute(
                    f"UPDATE {SCHEMA}.withdrawals SET status = 'rejected', admin_comment = %s, "
                    f"processed_by = %s, processed_at = NOW() WHERE id = %s",
                    (comment, admin["id"], wid)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Заявка отклонена, деньги возвращены пользователю"})}

        # Статистика платформы
        if action == "stats":
            with conn.cursor() as cur:
                cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.platform_earnings")
                total_commission = float(cur.fetchone()[0])
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.withdrawals WHERE status = 'pending'")
                pending_count = cur.fetchone()[0]
                cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.withdrawals WHERE status = 'pending'")
                pending_amount = float(cur.fetchone()[0])
                cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.withdrawals WHERE status = 'paid'")
                paid_total = float(cur.fetchone()[0])
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
                users_count = cur.fetchone()[0]
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.orders WHERE escrow_status = 'completed'")
                completed_orders = cur.fetchone()[0]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "total_commission": total_commission,
                "pending_count": pending_count,
                "pending_amount": pending_amount,
                "paid_total": paid_total,
                "users_count": users_count,
                "completed_orders": completed_orders,
            })}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()
