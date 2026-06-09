-- Архивируем тестовый букет и возвращаем балансы/счётчики пользователей в исходное состояние
UPDATE t_p84229990_flower_resale_auctio.bouquets SET status = 'archived', title = '[ТЕСТ-АРХИВ] ' || title WHERE id = 1;
UPDATE t_p84229990_flower_resale_auctio.users SET balance = 0, sales_count = 0, purchases_count = 0, reviews_count = 0, rating = 5.0, payout_method = NULL, payout_details = NULL WHERE id IN (1, 2);
