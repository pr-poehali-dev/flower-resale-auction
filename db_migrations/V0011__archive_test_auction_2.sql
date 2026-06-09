UPDATE t_p84229990_flower_resale_auctio.bouquets SET status = 'archived', title = '[ТЕСТ-АРХИВ] ' || title WHERE id = 2;
UPDATE t_p84229990_flower_resale_auctio.orders SET escrow_status = 'archived' WHERE bouquet_id = 2;
UPDATE t_p84229990_flower_resale_auctio.users SET sales_count = 0 WHERE id = 1;
