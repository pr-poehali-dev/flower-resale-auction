-- Убираем ограничение максимальной цены: расширяем разрядность денежных полей
ALTER TABLE t_p84229990_flower_resale_auctio.bouquets
  ALTER COLUMN start_price TYPE NUMERIC(14,2),
  ALTER COLUMN current_price TYPE NUMERIC(14,2),
  ALTER COLUMN min_step TYPE NUMERIC(14,2);

ALTER TABLE t_p84229990_flower_resale_auctio.orders
  ALTER COLUMN amount TYPE NUMERIC(14,2),
  ALTER COLUMN commission TYPE NUMERIC(14,2);

ALTER TABLE t_p84229990_flower_resale_auctio.users
  ALTER COLUMN balance TYPE NUMERIC(14,2);

ALTER TABLE t_p84229990_flower_resale_auctio.withdrawals
  ALTER COLUMN amount TYPE NUMERIC(14,2);

ALTER TABLE t_p84229990_flower_resale_auctio.platform_earnings
  ALTER COLUMN amount TYPE NUMERIC(14,2);

ALTER TABLE t_p84229990_flower_resale_auctio.bids
  ALTER COLUMN amount TYPE NUMERIC(14,2);
