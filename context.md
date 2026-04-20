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
| Hosting | Railway (Backend) / SSH VPS (WhatsApp Bot) | Backend on Railway, Bot on SSH `shabbat` |
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

## Admin Panel
- Access: `/admin` route — `AdminRoute` checks `GET /api/admin/me`, redirects to `/` if not admin
- Full spec: [docs/admin-dashboard.md](docs/admin-dashboard.md)

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

---

## WhatsApp Bot (Phase 2 - Implemented April 2026)

The WhatsApp bot handles league management, betting, and leaderboards directly within group chats.

### 🏠 Hosting & Deployment
- **Server:** SSH VPS `shabbat` (IONOS/Ubuntu).
- **Path:** `/root/kickoff-bot/` (Mono-repo synced via GitHub).
- **Process Manager:** `pm2` (process name: `kickoff-bot`).
- **Database:** Shares the same PostgreSQL on Railway as the main site.
- **Independence:** The bot **does not** run on Railway. All code changes must be pushed to GitHub, pulled on the VPS, and restarted via PM2.

### 🤖 Core Commands
- **`עזרה` / `/help`**: Displays the help menu.
- **`שלח טבלה גבר`**: (Group only) Fetches the official league leaderboard from the DB.
  - *Note:* This command is phrase-based and does not require a bot mention (@).
- **Betting**: Reply to a game notification with `1`, `X`, or `2`.
- **Bet Correction (`תיקון`)**: To update a bet, the user must reply to the bot's confirmation message (or their bet) with:
  ```
  תיקון
  [1/X/2] [Score]
  ```
  Example: `תיקון \n 1 2-1`. The bot acknowledges with a 👍 reaction.

### ⚙️ Technical Details
- **Library:** `whatsapp-web.js`.
- **User Identification:** Based on phone number (Israel `972...` format).
- **Group Association:** Handled via the `wa_groups` table (mapped JID → `league_id`).
- **Usernames:** Globally enforced to be **lowercase** in both the bot and website for consistency.
- **Precise Scoring:** Leaderboard points are displayed with decimal precision (e.g., `12.5 נקודות`) instead of being rounded.

*Last updated: 2026-04-21*
