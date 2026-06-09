ALTER TABLE t_p84229990_flower_resale_auctio.users
    ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS email_token VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS email_token_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
    ON t_p84229990_flower_resale_auctio.users (email)
    WHERE email IS NOT NULL;