-- Роль администратора
ALTER TABLE t_p84229990_flower_resale_auctio.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Реквизиты для вывода средств
ALTER TABLE t_p84229990_flower_resale_auctio.users
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS payout_details VARCHAR(255);

-- Таблица заявок на вывод средств
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.withdrawals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.users(id),
  amount NUMERIC(10,2) NOT NULL,
  method VARCHAR(20) NOT NULL,
  details VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_comment TEXT,
  processed_by INTEGER REFERENCES t_p84229990_flower_resale_auctio.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON t_p84229990_flower_resale_auctio.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON t_p84229990_flower_resale_auctio.withdrawals(status);

-- Журнал комиссии платформы (накопление с каждой завершённой сделки)
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.platform_earnings (
  id SERIAL PRIMARY KEY,
  order_id INTEGER,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
