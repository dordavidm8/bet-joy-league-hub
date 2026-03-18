-- Kickoff — Database Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid VARCHAR(128) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar_url TEXT,
  points_balance INTEGER NOT NULL DEFAULT 500,
  total_bets INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  referred_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL, -- signup | bet_placed | bet_won | bet_lost | referral | quiz_won | league_entry | league_payout
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(100),
  logo_url TEXT,
  season INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id VARCHAR(50) UNIQUE NOT NULL,
  competition_id UUID REFERENCES competitions(id),
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  home_team_logo TEXT,
  away_team_logo TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled', -- scheduled | live | finished | postponed | cancelled
  minute INTEGER,
  home_score INTEGER,
  away_score INTEGER,
  raw_data JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bet_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  question_type VARCHAR(50) NOT NULL, -- winner | total_goals | both_teams_score
  question_text TEXT NOT NULL,
  options JSONB NOT NULL, -- [{ key, label, odds }]
  correct_option VARCHAR(50),
  is_available_live BOOLEAN NOT NULL DEFAULT true,
  live_lock_minute INTEGER NOT NULL DEFAULT 75,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id),
  bet_question_id UUID NOT NULL REFERENCES bet_questions(id),
  selected_option VARCHAR(50) NOT NULL,
  stake INTEGER NOT NULL,
  odds DECIMAL(6,2) NOT NULL,
  live_penalty_pct INTEGER NOT NULL DEFAULT 0,
  potential_payout INTEGER NOT NULL,
  actual_payout INTEGER,
  is_live_bet BOOLEAN NOT NULL DEFAULT false,
  match_minute_placed INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | won | lost | void
  parlay_id UUID,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS parlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_stake INTEGER NOT NULL,
  total_odds DECIMAL(10,2) NOT NULL,
  potential_payout INTEGER NOT NULL,
  actual_payout INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

ALTER TABLE bets ADD CONSTRAINT IF NOT EXISTS bets_parlay_fk
  FOREIGN KEY (parlay_id) REFERENCES parlays(id);

CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES users(id),
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  format VARCHAR(20) NOT NULL, -- pool | per_game
  duration_type VARCHAR(20) NOT NULL, -- full_season | single_round | cup
  access_type VARCHAR(20) NOT NULL DEFAULT 'invite', -- open | invite
  min_bet INTEGER NOT NULL DEFAULT 10,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  pool_total INTEGER NOT NULL DEFAULT 0,
  distribution JSONB,
  allowed_competitions JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | finished | cancelled
  season_end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_in_league INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL, -- [{ key, label }]
  correct_option VARCHAR(10) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  game_id UUID REFERENCES games(id),
  points_reward INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id),
  selected_option VARCHAR(10) NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id),
  referred_id UUID NOT NULL UNIQUE REFERENCES users(id),
  points_awarded INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_start_time ON games(start_time);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON league_members(user_id);
