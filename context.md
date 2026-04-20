# Kickoff - Project Context

## Overview
A social sports betting app (points-based, no real money) similar to Fabula Football and playfootball.games.
Users bet with points on sports games - results, stats, and live in-game events.

---

## App Name
**Kickoff**

---

## Working Directory
**Active repo:** `/Users/nirdahan/Documents/bet-joy-league-hub`

```
bet-joy-league-hub/
├── src/              ← React/Vite frontend (built in Loveable)
├── backend/          ← Node.js + Express + PostgreSQL backend
└── context.md        ← this file
```

---

## Target Audience
- Age: Young adults to adults (18+, age verification required)
- Knowledge: Basic sports background
- Language: Hebrew first, English support added later
- Region: Israel initially, international expansion planned

---

## Platform
- **Phase 1:** Web app (React/Vite, built in Loveable)
- **Phase 2:** WhatsApp bot for managing leagues inside group chats

---

## Tech Stack (decided)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React + Vite + TypeScript + Tailwind | Built in Loveable |
| Backend | Node.js + Express | `/backend/src/app.js` |
| Database | PostgreSQL | Hosted on Railway |
| Auth | Firebase Auth | Google, Facebook, Email+Password |
| Sports API | **API-Football** (api-football.com) | Free tier for dev, paid for prod |
| Real-time | Socket.io | Live betting score updates |
| Hosting | Railway | Backend + PostgreSQL |
| API style | REST | Simple, compatible with frontend |

---

## Core Features

### Betting
- Bet types: Final result / winner (always included), + 1-2 additional options per game
- **2-3 bet questions per game minimum** (auto-generated from API data)
- Live betting: Yes — available until **minute 75**, locked after that
- Parlays: Yes (combined bets across multiple games)
- Sports: **Football (soccer) only** in Phase 1

### Live Betting Penalty System
Discourages last-minute "safe" bets by reducing payout:

| Match Minute | Penalty | Effect |
|-------------|---------|--------|
| 0–45 | 0% | No penalty |
| 46–60 | 10% | Slight reduction |
| 61–70 | 25% | Moderate reduction |
| 71–75 | 40% | Heavy reduction |
| 76+ | Locked | No betting allowed |

**Formula:** `payout = stake × odds × (1 - penalty%)`

### Points System
- New user starting balance: **500 points**
- Winning a bet: `stake × odds × (1 - live_penalty%)` — payout based on real API odds
- Referral (successful): **1,000 points** to referrer
- Quiz correct answer: **50 points**
- Real money: None in Phase 1

### Private Leagues (highest priority)
- Create leagues with invite links
- **Two formats:**
  1. **Pool format:** Fixed entry fee → pool distributed at season end by manager-chosen %
  2. **Per-game format:** Fixed fee per game
- **Duration:** Full season / single round / cup — all available
- League manager controls: access (open/invite), min bet, allowed competitions, prize distribution
- **If a user leaves a pool league → they forfeit their entry fee (stays in pool)**
- **Settlement:** League creator manually triggers end-of-season payout
- **Prize distribution:** Manager sets percentages (e.g. 60/30/10) — must sum to 100%

### AI Betting Advisor (LLM)
- Chat interface to consult AI before placing bets
- Analyzes historical match data from API (past results, head-to-head, form)
- Tone: friendly advisor — "based on past data..."
- Accessible from Game Detail screen

### Leaderboards & Social
- Global leaderboard (by points balance)
- Private league leaderboards
- Friends competition

---

## Authentication
- Google login (Firebase)
- Meta (Facebook) login (Firebase)
- Email + password (Firebase)
- Age verification: Must confirm 18+

---

## Onboarding
- First-time user onboarding flow / tutorial screen

---

## Notifications (Push)
- Bet result: win or loss
- Game starting soon
- Other relevant updates

---

## Admin Panel (Dashboard)

### Access Control
- Route: `/admin` — wrapped in `AdminRoute` component that calls `GET /api/admin/me`
- Backend: `requireAdmin` middleware checks `ADMIN_EMAILS` env var first, then `admin_users` DB table
- Railway env var: `ADMIN_EMAILS=nir.dahan2001@gmail.com,dordavidm8@gmail.com,kickoffsportsapp@gmail.com`
- New admins can be added dynamically via the dashboard (no redeploy needed)
- No AppLayout wrapper — own header with "קיקאוף ניהול" title + "חזור לאפליקציה" button

### Tabs (8 total)

#### 1. סקירה (Stats)
- 6 KPI cards: total users (+ new today/month), total bets (+ pending + live), wins/losses + win rate, active leagues, total staked, platform profit
- Transactions by type table: type, count, volume (points)

#### 2. משתמשים (Users)
- Search by username/email (live filter, up to 200 results)
- **Adjust points** modal: amount (positive/negative) + reason text
- **View bets** modal: all user bets with status badges + cancel button for pending
- **Edit user** modal: change username and/or display name
- **Delete user** with confirmation (permanent)
- **Unlink phone** for a user

#### 3. הימורים (Bets)
- Filter by status: all | pending | won | lost | cancelled
- Cancel button per row (pending bets only) — refunds stake, cancels parlay if applicable

#### 4. משחקים (Games)
- Tabs: upcoming / finished
- Filters: team name search, league, status, blocked/open, odds source (espn/api/default/admin), date range
- Sortable by: time, bet count, score
- **Feature game** (⭐): set bonus % and hours_before — live payout preview shown
- **Unfeature** a featured game
- **Lock / Unlock** game (blocks new bets)
- **Edit odds** modal: override home/draw/away odds manually
- **Expand row** (⌄): inline analytics — outcome breakdown (bet_count, total_staked, %)

#### 5. ליגות (Leagues)
- Search by league name or creator username
- Filter by status: active | paused | finished
- **Pause league** with confirmation
- **Stop league** with option to distribute prize pool or not
- **WhatsApp group** management per league: view/edit invite link, remove WA group
- **Create public league** form directly from admin (name, description, format, entry fee, max members)
- Click row → navigate to `/leagues/:id` (read-only view in main app)

#### 6. התראות (Notifications)
- Type: `admin_message` | `special_offer`
- Target: all users | specific username
- Title + body fields → `POST /admin/notify`

#### 7. אתגרים (Mini Games / Challenges)
- Generate questions for any mini game type via AI: **Trivia יומית (AI)**, Missing XI, Who Are Ya?, Career Path, Box2Box, Guess Club
- For trivia: choose category (general/football/etc.), optional custom topic, type (free/premium)
- Preview generated draft before saving
- **Save to queue** — each day the system pulls the first item in queue per category
- **Queue management**: view upcoming scheduled items, change play date, delete from queue

#### 8. מתקדם (Advanced) — 4 sub-sections
- **⚽ תחרויות**: table of all competitions with is_active toggle
- **🔑 מנהלים**: list current admins (env=ראשי / DB=removable), add by email, remove
- **🌐 תרגומי קבוצות**: approve/dismiss AI-suggested Hebrew team name translations, regenerate bet questions
- **📋 לוג פעולות**: last 100 admin actions with Hebrew labels and timestamps

### Backend Routes (`backend/src/routes/admin.js`)
All require `requireAdmin` middleware.
- `GET /admin/me` → `{ is_admin, email }`
- `GET /admin/stats`, `GET /admin/users`, `GET /admin/bets`, `GET /admin/games`, `GET /admin/leagues`
- `POST /admin/users/:id/adjust-points`
- `PATCH /admin/users/:id` (edit username/display name), `DELETE /admin/users/:id`
- `POST /admin/users/:id/unlink-phone`
- `POST /admin/notify`
- `GET /admin/quiz`, `POST /admin/quiz`, `DELETE /admin/quiz/:id`
- `POST /admin/games/:id/feature`, `DELETE /admin/games/:id/feature`
- `POST /admin/games/:id/lock`, `POST /admin/games/:id/unlock`
- `PATCH /admin/games/:id/odds`
- `GET /admin/games/:id/analytics`
- `GET /admin/users/:id/bets`, `POST /admin/bets/:id/cancel`
- `POST /admin/leagues/:id/pause`, `POST /admin/leagues/:id/stop`
- `POST /admin/leagues/:id/wa-group`, `DELETE /admin/leagues/:id/wa-group`
- `GET /admin/competitions`, `PATCH /admin/competitions/:id/toggle`
- `GET /admin/log`
- `GET /admin/admins`, `POST /admin/admins`, `DELETE /admin/admins/:email`
- `GET /admin/team-translations`, `POST /admin/team-translations/approve`, `POST /admin/team-translations/dismiss`
- `POST /admin/regenerate-bet-questions`
- `GET /admin/mini-game-draft`, `POST /admin/mini-game-draft`
- `GET /admin/mini-game-queue`, `PATCH /admin/mini-game-queue/:id`, `DELETE /admin/mini-game-queue/:id`

### DB tables
- `admin_users`: dynamically-added admins (email, added_by, added_at)
- `admin_action_log`: id, admin_email, action, entity_type, entity_id, details (JSONB), created_at

### Services
- `backend/src/services/adminLogService.js` — `logAdminAction(adminEmail, action, entityType, entityId, details)` called after every admin mutation

---

## Backend Structure

```
backend/
├── src/
│   ├── app.js                    ← Express server + Socket.io
│   ├── config/
│   │   ├── database.js           ← PostgreSQL (pg Pool)
│   │   └── firebase.js           ← Firebase Admin SDK
│   ├── middleware/
│   │   ├── auth.js               ← Firebase token verification → req.user
│   │   └── errorHandler.js
│   ├── db/
│   │   ├── schema.sql            ← Full DB schema
│   │   └── migrate.js            ← Run: npm run migrate
│   ├── routes/
│   │   ├── auth.js               ← POST /register, GET /me
│   │   ├── users.js              ← stats, transactions, bet history, referral code
│   │   ├── games.js              ← list games, live games, single game + bet questions
│   │   ├── bets.js               ← place single bet, place parlay, get bet
│   │   ├── leagues.js            ← create, join, leave, settle, leaderboard
│   │   ├── leaderboard.js        ← global ranking, user rank
│   │   ├── quiz.js               ← next question, submit answer
│   │   └── admin.js              ← analytics dashboard, user/bet/game management
│   ├── services/
│   │   ├── bettingService.js     ← live penalty logic + payout calculation
│   │   └── sportsApi.js          ← API-Football wrapper + bet question builder
│   └── jobs/
│       ├── index.js              ← cron scheduler
│       ├── syncGames.js          ← live scores every 60s + auto-lock questions
│       └── settleBets.js         ← settle bets every 5min + resolve questions
├── .env.example
└── package.json
```

## API Routes Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user (after Firebase signup) |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/users/me/stats` | User betting stats |
| GET | `/api/users/me/bets` | User bet history |
| GET | `/api/users/me/transactions` | Points ledger |
| GET | `/api/users/me/referral-code` | Get referral link |
| GET | `/api/games` | List games (filter: status, competition, date) |
| GET | `/api/games/live` | Live games only |
| GET | `/api/games/:id` | Game + bet questions |
| POST | `/api/bets` | Place single bet |
| POST | `/api/bets/parlay` | Place parlay |
| POST | `/api/leagues` | Create league |
| POST | `/api/leagues/join` | Join by invite code |
| POST | `/api/leagues/:id/leave` | Leave league |
| POST | `/api/leagues/:id/settle` | Trigger end-of-season payout (creator only) |
| GET | `/api/leagues/my/list` | My leagues |
| GET | `/api/leaderboard/global` | Global leaderboard |
| GET | `/api/leaderboard/me` | My rank |
| GET | `/api/quiz/next` | Next unanswered quiz question |
| POST | `/api/quiz/:id/answer` | Submit answer |
| GET | `/api/admin/stats` | Admin analytics dashboard |

---

## Database Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts (firebase_uid, points_balance, etc.) |
| `point_transactions` | Full points ledger (every credit/debit) |
| `competitions` | Football competitions (synced from API) |
| `games` | Fixtures (synced from API, updated live) |
| `bet_questions` | Auto-generated questions per game with odds |
| `bets` | Individual user bets |
| `parlays` | Combined bets |
| `leagues` | Private leagues |
| `league_members` | League memberships + points_in_league |
| `quiz_questions` | Trivia questions |
| `quiz_attempts` | User answers |
| `referrals` | Referral tracking |

---

## Environment Variables (backend/.env)
```
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."
API_FOOTBALL_KEY=...
ADMIN_UIDS=uid1,uid2
```

---

## Setup Steps (backend)
```bash
cd backend
npm install
cp .env.example .env   # fill in values
npm run migrate        # creates all tables
npm run dev            # starts server on port 3000
```

---

## What's Left To Build (Phase 1 & 2 Remaining Tasks)
- [x] Firebase project setup (Auth)
- [x] Railway project setup (PostgreSQL + deploy)
- [x] Frontend connected to backend API
- [x] Auto-generation of Daily Mini Games (Box2Box, MissingXI, WhoAreYa, GuessClub)
- [ ] Implement AI Advisor route (`/api/advisor`) using Claude API
- [ ] Push notifications (Firebase Cloud Messaging) for bet results and game updates
- [ ] Complete real API implementation (API-Football) for Live Betting and Odds
- [ ] Private League settlement and prize distribution logic
- [ ] WhatsApp bot integration for League management (Phase 2)

---

## Design Preferences
- **Mode:** Light (bright)
- **Style:** Minimal / Modern
- **Colors:** Primary green `#4CAF50`, white bg, light gray `#F5F5F5`
- **Feel:** Revolut / Cash App meets sports — clean, not a dark sportsbook

---

## Future Plans
- English language support
- Additional sports (basketball, tennis, NFL...)
- WhatsApp bot for league management
- Points purchase with real money
- Real-money betting (pending regulation)

---

## Mini Games Engine Updates (Implemented April 2026)
We completely refactored the Daily Mini Games architecture (`/backend/src/jobs/generateMiniGames.js` and `/src/components/minigames/`) to be highly reliable, dynamic, and bug-free.

### Implementation Details:
1. **GuessClub (נחשו את המועדון)**
   - **Backend**: Uses `fetchRecentEspnMatchIds` to fetch the scoreboard for a random Top 5 league, extracts real team logos from the competitors array, blurs them using `sharp`, and saves as Base64 to `daily_mini_games`.
   - **Frontend**: `CLUB_ALIASES` mapping was added to `GuessClubGame.tsx` (e.g., "wolves", "man utd", "spurs") so users aren't forced to guess exact official names.
2. **WhoAreYa (מי אתה?)**
   - **Backend**: Overrode fragile Wikipedia HTML parsing. `PLAYERS` is now a curated, hardcoded list mapping names to Wikidata QIDs, Clubs, Nationalities, and Positions. Wikipedia is only used to extract the high-quality image URL (via cheerio), which is returned to the client and blurred via CSS.
3. **MissingXI (ההרכב החסר)**
   - **Backend**: Checks ESPN match summaries dynamically for valid recent lineups. We extract the `opponentName` and `league` to construct `matchContext` (e.g., "שוחק נגד Liverpool (Premier League)"). This context explicitly grounds the lineup in time (resolving confusion if players transferred clubs recently).
   - **Frontend**: Displays `matchContext` beneath the team name in `MissingXIGame.tsx` for absolute clarity.
4. **Box2Box (בוקס2בוקס)**
   - **Backend**: Replaced the faulty `player_clubs` database query (which was unseeded and stuck on Juventus/Real Madrid) with a heavily curated `PAIRS` array inside `generateBox2Box`. Implements a 30-day anti-repeat check against `daily_mini_games` history.
5. **Admin Ops API**
   - **Backend**: Added protected routes `/api/ops/generate-minigames` and `/api/ops/reset-minigame-attempts` in `admin.js` to allow easy triggering and QA. Authorized via the `x-ops-key` header.
6. **Infrastructure (Railway)**
   - Configured `helmet` CSP to explicitly allow `upload.wikimedia.org` and `*.wikimedia.org` images.
   - Enforced Node version `>=18` to fix deploy crashes on Railway.

---

*Last updated: 2026-04-07*
