CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.payment_log (
    id SERIAL PRIMARY KEY,
    payment_id VARCHAR(64) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);