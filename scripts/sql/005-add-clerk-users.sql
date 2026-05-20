ALTER TABLE players
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;

ALTER TABLE players
  ALTER COLUMN api_key_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_players_clerk_user_id ON players(clerk_user_id);
