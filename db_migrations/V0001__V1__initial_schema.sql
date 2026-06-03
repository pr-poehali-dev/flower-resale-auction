
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  rating NUMERIC(3,2) DEFAULT 5.0,
  reviews_count INT DEFAULT 0,
  sales_count INT DEFAULT 0,
  purchases_count INT DEFAULT 0,
  balance NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES t_p84229990_flower_resale_auctio.users(id),
  token VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.bouquets (
  id SERIAL PRIMARY KEY,
  seller_id INT REFERENCES t_p84229990_flower_resale_auctio.users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  flowers TEXT[],
  freshness VARCHAR(50),
  image_urls TEXT[],
  start_price NUMERIC(10,2) NOT NULL,
  current_price NUMERIC(10,2) NOT NULL,
  min_step NUMERIC(10,2) DEFAULT 50,
  bids_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  ends_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.bids (
  id SERIAL PRIMARY KEY,
  bouquet_id INT REFERENCES t_p84229990_flower_resale_auctio.bouquets(id),
  user_id INT REFERENCES t_p84229990_flower_resale_auctio.users(id),
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.orders (
  id SERIAL PRIMARY KEY,
  bouquet_id INT REFERENCES t_p84229990_flower_resale_auctio.bouquets(id),
  buyer_id INT REFERENCES t_p84229990_flower_resale_auctio.users(id),
  seller_id INT REFERENCES t_p84229990_flower_resale_auctio.users(id),
  amount NUMERIC(10,2) NOT NULL,
  commission NUMERIC(10,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  delivery_address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.reviews (
  id SERIAL PRIMARY KEY,
  reviewer_id INT REFERENCES t_p84229990_flower_resale_auctio.users(id),
  target_id INT REFERENCES t_p84229990_flower_resale_auctio.users(id),
  order_id INT REFERENCES t_p84229990_flower_resale_auctio.orders(id),
  stars INT CHECK (stars BETWEEN 1 AND 5),
  text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.messages (
  id SERIAL PRIMARY KEY,
  sender_id INT REFERENCES t_p84229990_flower_resale_auctio.users(id),
  receiver_id INT REFERENCES t_p84229990_flower_resale_auctio.users(id),
  bouquet_id INT REFERENCES t_p84229990_flower_resale_auctio.bouquets(id),
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.favorites (
  user_id INT REFERENCES t_p84229990_flower_resale_auctio.users(id),
  bouquet_id INT REFERENCES t_p84229990_flower_resale_auctio.bouquets(id),
  PRIMARY KEY (user_id, bouquet_id)
);

CREATE INDEX IF NOT EXISTS idx_bouquets_status ON t_p84229990_flower_resale_auctio.bouquets(status);
CREATE INDEX IF NOT EXISTS idx_bouquets_ends_at ON t_p84229990_flower_resale_auctio.bouquets(ends_at);
CREATE INDEX IF NOT EXISTS idx_bids_bouquet ON t_p84229990_flower_resale_auctio.bids(bouquet_id);
CREATE INDEX IF NOT EXISTS idx_messages_users ON t_p84229990_flower_resale_auctio.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON t_p84229990_flower_resale_auctio.sessions(token);
