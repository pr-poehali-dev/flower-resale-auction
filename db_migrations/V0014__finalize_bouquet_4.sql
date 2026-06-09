-- Завершаем просроченный аукцион id=4 (победитель user_id=5, ставка 51₽)
UPDATE t_p84229990_flower_resale_auctio.bouquets SET status = 'won' WHERE id = 4 AND status = 'active';

INSERT INTO t_p84229990_flower_resale_auctio.orders (bouquet_id, buyer_id, seller_id, amount, commission, escrow_status)
SELECT 4, 5, b.seller_id, 51.00, 6.12, 'waiting_payment'
FROM t_p84229990_flower_resale_auctio.bouquets b
WHERE b.id = 4
AND NOT EXISTS (SELECT 1 FROM t_p84229990_flower_resale_auctio.orders WHERE bouquet_id = 4);