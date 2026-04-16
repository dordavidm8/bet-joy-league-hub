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
  type VARCHAR(50) NOT NULL,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(100),
  logo_url TEXT,
  season INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  espn_id VARCHAR(50) UNIQUE NOT NULL,
  competition_id UUID REFERENCES competitions(id),
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  home_team_logo TEXT,
  away_team_logo TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  minute INTEGER,
  score_home INTEGER,
  score_away INTEGER,
  venue VARCHAR(200),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bet_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  question_text TEXT NOT NULL,
  outcomes JSONB NOT NULL,
  correct_outcome VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  is_available_live BOOLEAN NOT NULL DEFAULT true,
  live_lock_minute INTEGER NOT NULL DEFAULT 75,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id),
  bet_question_id UUID NOT NULL REFERENCES bet_questions(id),
  selected_outcome VARCHAR(100) NOT NULL,
  stake INTEGER NOT NULL,
  odds DECIMAL(6,2) NOT NULL,
  live_penalty_pct INTEGER NOT NULL DEFAULT 0,
  potential_payout INTEGER NOT NULL,
  actual_payout INTEGER,
  is_live_bet BOOLEAN NOT NULL DEFAULT false,
  match_minute_placed INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  parlay_id UUID REFERENCES parlays(id),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES users(id),
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  format VARCHAR(20) NOT NULL,
  duration_type VARCHAR(20) NOT NULL,
  access_type VARCHAR(20) NOT NULL DEFAULT 'invite',
  min_bet INTEGER NOT NULL DEFAULT 10,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  pool_total INTEGER NOT NULL DEFAULT 0,
  distribution JSONB,
  allowed_competitions JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
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
  options JSONB NOT NULL,
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

CREATE TABLE IF NOT EXISTS daily_mini_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type VARCHAR(20) NOT NULL CHECK (game_type IN ('missing_xi', 'who_are_ya', 'career_path', 'box2box', 'guess_club')),
  play_date DATE NOT NULL,
  puzzle_data JSONB NOT NULL,
  solution JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_mini_games_date ON daily_mini_games(play_date, game_type);

CREATE TABLE IF NOT EXISTS mini_game_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id UUID NOT NULL REFERENCES daily_mini_games(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, puzzle_id)
);

CREATE INDEX IF NOT EXISTS idx_mini_game_attempts_user ON mini_game_attempts(user_id);

CREATE TABLE IF NOT EXISTS player_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name VARCHAR(100) NOT NULL,
  club_name VARCHAR(100) NOT NULL,
  years JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_name, club_name)
);

CREATE INDEX IF NOT EXISTS idx_player_clubs_name ON player_clubs(player_name);
CREATE INDEX IF NOT EXISTS idx_player_clubs_club ON player_clubs(club_name);

-- Tournament league columns
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS tournament_slug VARCHAR(50) REFERENCES competitions(slug);
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS stake_per_match INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS join_policy VARCHAR(20) NOT NULL DEFAULT 'anytime';
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS auto_settle BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS penalty_per_missed_bet INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS max_members INTEGER;

-- Featured match columns
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS featured_bonus_pct INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS featured_notif_hours INTEGER NOT NULL DEFAULT 2;
ALTER TABLE games ADD COLUMN IF NOT EXISTS featured_notif_sent BOOLEAN NOT NULL DEFAULT false;

-- Quiz scheduling
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS publish_date DATE;

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_log_created ON admin_action_log(created_at DESC);

CREATE TABLE IF NOT EXISTS tournament_missed_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  penalty_applied INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_missed_bets_league ON tournament_missed_bets(league_id);
CREATE INDEX IF NOT EXISTS idx_tournament_missed_bets_user ON tournament_missed_bets(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS advisor_usage (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- User follows (friend system)
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followed_id)
);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_followed ON user_follows(followed_id);

-- Ensure points_balance cannot go negative
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT check_points_balance_non_negative CHECK (points_balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_key)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- ── Per-league betting system ─────────────────────────────────────────────────

-- League bet mode: how members bet within this league
--   'minimum_stake'   → stake deducted from global balance, min per game enforced
--   'initial_balance' → no stake deducted; winning awards odds-based league points
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS bet_mode VARCHAR(20) NOT NULL DEFAULT 'minimum_stake';

-- Link each bet to a specific league (NULL = global bet, unrelated to any league)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id);

-- One global bet per user per question
CREATE UNIQUE INDEX IF NOT EXISTS idx_bets_user_question_global
  ON bets(user_id, bet_question_id) WHERE league_id IS NULL;

-- One bet per user per question per league
CREATE UNIQUE INDEX IF NOT EXISTS idx_bets_user_question_league
  ON bets(user_id, bet_question_id, league_id) WHERE league_id IS NOT NULL;

-- Allow fractional league points (e.g. winning at odds 2.1 → +2.10 pts)
DO $$ BEGIN
  IF (
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'league_members' AND column_name = 'points_in_league'
  ) = 'integer' THEN
    ALTER TABLE league_members
      ALTER COLUMN points_in_league TYPE DECIMAL(10,2)
      USING points_in_league::DECIMAL(10,2);
  END IF;
END $$;
