
ALTER TABLE t_p84229990_flower_resale_auctio.users
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE t_p84229990_flower_resale_auctio.bouquets
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS meet_point TEXT;

ALTER TABLE t_p84229990_flower_resale_auctio.orders
  ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(30) DEFAULT 'waiting_payment',
  ADD COLUMN IF NOT EXISTS seller_phone_revealed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS auto_confirm_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_bouquets_city ON t_p84229990_flower_resale_auctio.bouquets(city);
CREATE INDEX IF NOT EXISTS idx_orders_escrow ON t_p84229990_flower_resale_auctio.orders(escrow_status);
