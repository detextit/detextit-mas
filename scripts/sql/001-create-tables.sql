CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  api_key_hash TEXT UNIQUE,
  clerk_user_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin', 'service')),
  credits NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
  total_market_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_spent NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  market_price NUMERIC(10, 2) NOT NULL CHECK (market_price > 0),
  min_acceptable_price NUMERIC(10, 2) NOT NULL CHECK (min_acceptable_price > 0),
  category TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  seller_personality TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (min_acceptable_price <= market_price)
);

CREATE TABLE IF NOT EXISTS haggle_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'rejected', 'abandoned', 'expired')),
  current_offer NUMERIC(10, 2),
  ai_counter_offer NUMERIC(10, 2),
  rounds_count INTEGER NOT NULL DEFAULT 0,
  max_rounds INTEGER NOT NULL DEFAULT 10,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  final_price NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS haggle_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES haggle_sessions(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('player', 'seller')),
  message TEXT NOT NULL,
  offer_amount NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id UUID REFERENCES haggle_sessions(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  market_price NUMERIC(10, 2) NOT NULL,
  final_price NUMERIC(10, 2) NOT NULL,
  savings NUMERIC(10, 2) GENERATED ALWAYS AS (market_price - final_price) STORED,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_api_key_hash ON players(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_players_clerk_user_id ON players(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_haggle_sessions_player_status ON haggle_sessions(player_id, status);
CREATE INDEX IF NOT EXISTS idx_haggle_messages_session ON haggle_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions(player_id, created_at DESC);

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.username,
  p.email,
  p.credits,
  p.total_market_value,
  p.total_spent,
  CASE
    WHEN p.total_spent > 0 THEN ROUND((p.total_market_value / p.total_spent)::numeric, 4)
    ELSE 0
  END AS score,
  COUNT(t.id)::integer AS items_purchased,
  COALESCE(SUM(t.savings), 0)::numeric(10, 2) AS total_savings
FROM players p
LEFT JOIN transactions t ON t.player_id = p.id AND t.status = 'completed'
GROUP BY p.id, p.username, p.email, p.credits, p.total_market_value, p.total_spent;
