
ALTER TABLE t_p84229990_flower_resale_auctio.users
  ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20),
  ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth
  ON t_p84229990_flower_resale_auctio.users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;
