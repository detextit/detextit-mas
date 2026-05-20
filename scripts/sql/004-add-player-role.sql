ALTER TABLE players
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_role_check'
  ) THEN
    ALTER TABLE players
      ADD CONSTRAINT players_role_check CHECK (role IN ('player', 'admin', 'service'));
  END IF;
END $$;
