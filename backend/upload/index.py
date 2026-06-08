"""Загрузка фотографий букетов в S3"""
import json
import os
import base64
import uuid
import boto3
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

def get_user_by_token(conn, token: str):
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id FROM {SCHEMA}.sessions s "
            f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    return {"id": row[0]} if row else None

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")
    conn = get_conn()
    try:
        user = get_user_by_token(conn, token)
        if not user:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}

        body = json.loads(event.get("body") or "{}")
        image_b64 = body.get("image")
        content_type = body.get("content_type", "image/jpeg")
        if not image_b64:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "image required"})}

        image_data = base64.b64decode(image_b64)
        ext = "jpg" if "jpeg" in content_type else content_type.split("/")[-1]
        key = f"bouquets/{uuid.uuid4()}.{ext}"

        s3 = get_s3()
        s3.put_object(Bucket="files", Key=key, Body=image_data, ContentType=content_type)

        access_key = os.environ["AWS_ACCESS_KEY_ID"]
        url = f"https://cdn.poehali.dev/projects/{access_key}/files/{key}"
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"url": url})}
    finally:
        conn.close()