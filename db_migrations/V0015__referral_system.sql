-- Реферальная система
ALTER TABLE t_p84229990_flower_resale_auctio.users
    ADD COLUMN IF NOT EXISTS ref_code VARCHAR(16) UNIQUE,
    ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES t_p84229990_flower_resale_auctio.users(id),
    ADD COLUMN IF NOT EXISTS ref_earnings NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Генерируем реф-коды для существующих пользователей
UPDATE t_p84229990_flower_resale_auctio.users
SET ref_code = UPPER(SUBSTRING(MD5(id::text || 'ff2026') FROM 1 FOR 8))
WHERE ref_code IS NULL;

-- Таблица начислений рефералу
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.referral_payouts (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.users(id),
    referee_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);