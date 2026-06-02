-- ============================================================
-- Cricket Court Manager - Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  is_admin BOOLEAN DEFAULT FALSE,
  pin TEXT,                        -- hashed PIN, required for admin and game_admin accounts
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,      -- NULL = active, set = inactive (reversible)
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'game_admin', 'admin'))
);

-- Migration: ensure role column exists on pre-existing installations and backfill from is_admin
ALTER TABLE players ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player'
  CHECK (role IN ('player', 'game_admin', 'admin'));
UPDATE players SET role = 'admin' WHERE is_admin = TRUE AND role = 'player';

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cost NUMERIC(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES players(id) ON DELETE SET NULL
);

-- Migration: ensure created_by exists on pre-existing installations
ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES players(id) ON DELETE SET NULL;

-- Backfill historical matches with the current admin as creator (only fills NULLs, safe to re-run)
UPDATE matches
SET created_by = (SELECT id FROM players WHERE role = 'admin' LIMIT 1)
WHERE created_by IS NULL
  AND EXISTS (SELECT 1 FROM players WHERE role = 'admin');

-- Match players (join table: who played in which match)
CREATE TABLE IF NOT EXISTS match_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  cost_share NUMERIC(10, 2) NOT NULL,
  UNIQUE(match_id, player_id)
);

-- Transactions table (source of truth for balances)
-- amount: positive = credit (topup), negative = debit (match deduction)
-- Only APPROVED transactions affect the player balance
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('TOPUP', 'MATCH', 'ADJUSTMENT', 'ACTIVITY')),
  status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reference_id UUID,       -- match_id for MATCH type transactions
  notes TEXT,
  proof_url TEXT,          -- optional screenshot URL for TOPUP
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- View: players with their computed balance
-- Column order is preserved so CREATE OR REPLACE works on pre-existing installations.
-- is_admin is derived from role for backward compatibility; role is appended at the end.
CREATE OR REPLACE VIEW player_balances AS
SELECT
  p.id,
  p.name,
  p.phone,
  (p.role = 'admin') AS is_admin,
  p.created_at,
  COALESCE(
    SUM(CASE WHEN t.status = 'APPROVED' THEN t.amount ELSE 0 END),
    0
  ) AS balance,
  p.role
FROM players p
LEFT JOIN transactions t ON t.player_id = p.id
WHERE p.deactivated_at IS NULL
GROUP BY p.id, p.name, p.phone, p.role, p.created_at;

-- Activities table (breakfast, dinner, other group expenses)
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  total_cost NUMERIC(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES players(id) ON DELETE SET NULL
);

-- Migration: ensure created_by exists on pre-existing installations
ALTER TABLE activities ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES players(id) ON DELETE SET NULL;

-- Backfill historical activities with the current admin as creator (only fills NULLs, safe to re-run)
UPDATE activities
SET created_by = (SELECT id FROM players WHERE role = 'admin' LIMIT 1)
WHERE created_by IS NULL
  AND EXISTS (SELECT 1 FROM players WHERE role = 'admin');

-- Activity players (join table: who participated in which activity)
CREATE TABLE IF NOT EXISTS activity_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  cost_share NUMERIC(10, 2) NOT NULL,
  UNIQUE(activity_id, player_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_player_id ON transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player_id ON match_players(player_id);
