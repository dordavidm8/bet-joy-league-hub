# סכמת בסיס הנתונים

PostgreSQL. 21 טבלאות.

---

## users

```sql
id              SERIAL PRIMARY KEY
firebase_uid    TEXT UNIQUE NOT NULL
email           TEXT UNIQUE NOT NULL
username        TEXT UNIQUE NOT NULL
display_name    TEXT
avatar_url      TEXT
points_balance  INTEGER DEFAULT 500  CHECK (points_balance >= 0)
total_bets      INTEGER DEFAULT 0
winning_bets    INTEGER DEFAULT 0
referred_by     INTEGER REFERENCES users(id)
created_at      TIMESTAMP DEFAULT NOW()
```

---

## point_transactions

```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
amount          INTEGER NOT NULL          -- חיובי = זיכוי, שלילי = חיוב
type            TEXT                      -- 'bet_win','bet_place','quiz','referral','league_prize','adjustment'
description     TEXT
reference_id    INTEGER                   -- bet_id / quiz_id וכו'
created_at      TIMESTAMP DEFAULT NOW()
```

---

## competitions

```sql
id              SERIAL PRIMARY KEY
espn_id         TEXT UNIQUE
name            TEXT NOT NULL
country         TEXT
logo_url        TEXT
is_active       BOOLEAN DEFAULT true
```

---

## games

```sql
id              SERIAL PRIMARY KEY
espn_id         TEXT UNIQUE NOT NULL
competition_id  INTEGER REFERENCES competitions(id)
home_team       TEXT NOT NULL
away_team       TEXT NOT NULL
home_team_logo  TEXT
away_team_logo  TEXT
scheduled_at    TIMESTAMP NOT NULL
status          TEXT DEFAULT 'scheduled'  -- scheduled | live | finished | cancelled
home_score      INTEGER
away_score      INTEGER
is_featured     BOOLEAN DEFAULT false
feature_bonus   NUMERIC(4,2) DEFAULT 0    -- % בונוס על משחק מוצג
created_at      TIMESTAMP DEFAULT NOW()
```

---

## bet_questions

```sql
id              SERIAL PRIMARY KEY
game_id         INTEGER REFERENCES games(id)
question_text   TEXT NOT NULL
options         JSONB NOT NULL            -- [{label, odds, key}]
correct_option  TEXT                      -- מתמלא לאחר תוצאה
is_locked       BOOLEAN DEFAULT false
question_type   TEXT                      -- 'winner','total_goals','btts',...
created_at      TIMESTAMP DEFAULT NOW()
```

**דוגמת options:**
```json
[
  {"label": "מנצ'סטר סיטי", "odds": 1.65, "key": "home"},
  {"label": "תיקו", "odds": 3.50, "key": "draw"},
  {"label": "ליברפול", "odds": 5.20, "key": "away"}
]
```

---

## bets

```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
question_id     INTEGER REFERENCES bet_questions(id)
selected_option TEXT NOT NULL
stake           INTEGER NOT NULL
odds            NUMERIC(6,2) NOT NULL
live_penalty    NUMERIC(4,2) DEFAULT 0    -- 0%–40%
potential_win   INTEGER NOT NULL
status          TEXT DEFAULT 'pending'    -- pending | won | lost | cancelled
settled_at      TIMESTAMP
created_at      TIMESTAMP DEFAULT NOW()
```

---

## parlays

```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
bet_ids         INTEGER[] NOT NULL        -- מערך של bet IDs
total_stake     INTEGER NOT NULL
combined_odds   NUMERIC(8,2) NOT NULL
potential_win   INTEGER NOT NULL
status          TEXT DEFAULT 'pending'
settled_at      TIMESTAMP
created_at      TIMESTAMP DEFAULT NOW()
```

---

## leagues

```sql
id              SERIAL PRIMARY KEY
name            TEXT NOT NULL
description     TEXT
manager_id      INTEGER REFERENCES users(id)
format          TEXT NOT NULL             -- 'pool' | 'per_game' | 'tournament'
invite_code     TEXT UNIQUE NOT NULL
competition_id  INTEGER REFERENCES competitions(id)
entry_fee       INTEGER DEFAULT 0
stake_per_game  INTEGER DEFAULT 0
prize_distribution JSONB                  -- [{place:1, pct:60}, ...]
auto_settle     BOOLEAN DEFAULT false
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMP DEFAULT NOW()
```

---

## league_members

```sql
id              SERIAL PRIMARY KEY
league_id       INTEGER REFERENCES leagues(id)
user_id         INTEGER REFERENCES users(id)
points          INTEGER DEFAULT 0
joined_at       TIMESTAMP DEFAULT NOW()
UNIQUE(league_id, user_id)
```

---

## tournament_missed_bets

```sql
id              SERIAL PRIMARY KEY
league_id       INTEGER REFERENCES leagues(id)
user_id         INTEGER REFERENCES users(id)
game_id         INTEGER REFERENCES games(id)
penalty_amount  INTEGER NOT NULL
created_at      TIMESTAMP DEFAULT NOW()
```

---

## quiz_questions

```sql
id              SERIAL PRIMARY KEY
question_text   TEXT NOT NULL
options         JSONB NOT NULL            -- [{ label, key }]
correct_option  TEXT NOT NULL
category        TEXT
difficulty      TEXT
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMP DEFAULT NOW()
```

---

## quiz_attempts

```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
question_id     INTEGER REFERENCES quiz_questions(id)
selected_option TEXT NOT NULL
is_correct      BOOLEAN NOT NULL
created_at      TIMESTAMP DEFAULT NOW()
UNIQUE(user_id, question_id)
```

---

## referrals

```sql
id              SERIAL PRIMARY KEY
referrer_id     INTEGER REFERENCES users(id)
referred_id     INTEGER REFERENCES users(id)
reward_given    BOOLEAN DEFAULT false
created_at      TIMESTAMP DEFAULT NOW()
```

---

## daily_mini_games

```sql
id              SERIAL PRIMARY KEY
type            TEXT NOT NULL             -- 'missing_xi' | 'who_are_ya' | 'guess_club' | 'box2box' | 'career_path' | 'trivia'
date            DATE NOT NULL
puzzle_data     JSONB NOT NULL
answer          JSONB NOT NULL
max_points      INTEGER DEFAULT 100
created_at      TIMESTAMP DEFAULT NOW()
UNIQUE(type, date)
```

---

## mini_game_attempts

```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
mini_game_id    INTEGER REFERENCES daily_mini_games(id)
answer          JSONB
is_correct      BOOLEAN
points_earned   INTEGER DEFAULT 0
attempts_used   INTEGER DEFAULT 1
completed_at    TIMESTAMP DEFAULT NOW()
UNIQUE(user_id, mini_game_id)
```

---

## player_clubs

```sql
id              SERIAL PRIMARY KEY
player_name     TEXT NOT NULL
clubs           JSONB NOT NULL            -- [{name, years, logo_url}]
wikidata_id     TEXT
image_url       TEXT
created_at      TIMESTAMP DEFAULT NOW()
```

---

## notifications

```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
type            TEXT NOT NULL             -- 'bet_result' | 'featured_match' | 'daily_challenge' | 'league_invite' | 'achievement'
title           TEXT NOT NULL
body            TEXT NOT NULL
data            JSONB                     -- metadata לפי סוג
is_read         BOOLEAN DEFAULT false
created_at      TIMESTAMP DEFAULT NOW()
```

---

## advisor_usage

```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
date            DATE NOT NULL DEFAULT CURRENT_DATE
message_count   INTEGER DEFAULT 0
UNIQUE(user_id, date)
```

---

## user_follows

```sql
id              SERIAL PRIMARY KEY
follower_id     INTEGER REFERENCES users(id)
followed_id     INTEGER REFERENCES users(id)
created_at      TIMESTAMP DEFAULT NOW()
UNIQUE(follower_id, followed_id)
```

---

## user_achievements

```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
achievement_key TEXT NOT NULL             -- 'first_bet' | 'first_win' | 'streak_3' | ...
unlocked_at     TIMESTAMP DEFAULT NOW()
UNIQUE(user_id, achievement_key)
```

---

## admin_action_log

```sql
id              SERIAL PRIMARY KEY
admin_id        INTEGER REFERENCES users(id)
action_type     TEXT NOT NULL             -- 'adjust_points' | 'notify_user' | 'feature_game' | ...
target_type     TEXT                      -- 'user' | 'game' | 'question'
target_id       INTEGER
details         JSONB
created_at      TIMESTAMP DEFAULT NOW()
```

---

## קשרים מרכזיים

```
users ──< bets >── bet_questions ──< games >── competitions
users ──< league_members >── leagues
users ──< quiz_attempts >── quiz_questions
users ──< mini_game_attempts >── daily_mini_games
users ──< notifications
users ──< user_achievements
users ──< user_follows >── users (self-join)
leagues ──< tournament_missed_bets >── games
```

---

## אינדקסים חשובים

```sql
CREATE INDEX ON users(firebase_uid);
CREATE INDEX ON games(scheduled_at);
CREATE INDEX ON games(status);
CREATE INDEX ON bets(user_id, created_at);
CREATE INDEX ON bets(status);
CREATE INDEX ON notifications(user_id, is_read);
CREATE INDEX ON point_transactions(user_id, created_at);
```
