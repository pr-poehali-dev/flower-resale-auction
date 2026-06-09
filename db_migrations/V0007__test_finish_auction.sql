-- Тестовое завершение аукциона (имитация окончания времени)
UPDATE t_p84229990_flower_resale_auctio.bouquets SET status = 'won', ends_at = NOW() WHERE id = 1;
