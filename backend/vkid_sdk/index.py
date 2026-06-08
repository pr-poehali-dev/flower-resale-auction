import urllib.request

def handler(event: dict, context) -> dict:
    '''Прокси для VK ID SDK — отдаёт JS с нашего домена, чтобы обойти блокировку CDN браузером (ERR_BLOCKED_BY_ORB)'''
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    sdk_urls = [
        'https://unpkg.com/@vkid/sdk/dist-sdk/umd/index.js',
        'https://cdn.jsdelivr.net/npm/@vkid/sdk/dist-sdk/umd/index.js',
    ]
    js_content = ''
    last_err = None
    for sdk_url in sdk_urls:
        try:
            req = urllib.request.Request(sdk_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=20) as r:
                js_content = r.read().decode('utf-8')
            break
        except Exception as e:
            last_err = e
            continue

    if not js_content:
        return {
            'statusCode': 502,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': f'// SDK load failed: {last_err}',
        }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400',
        },
        'body': js_content,
        'isBase64Encoded': False,
    }