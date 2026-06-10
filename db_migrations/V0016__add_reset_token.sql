ALTER TABLE t_p84229990_flower_resale_auctio.users
    ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64),
    ADD COLUMN IF NOT EXISTS reset_token_at TIMESTAMPTZ;