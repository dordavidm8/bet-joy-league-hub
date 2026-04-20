# Admin Dashboard

## Overview

The admin dashboard is a dedicated management interface for Kickoff platform administrators.
It lives at `/admin` (no AppLayout wrapper) with its own header: "קיקאוף ניהול" + "חזור לאפליקציה" button.

Frontend: `src/pages/AdminDashboard.tsx`
Backend routes: `backend/src/routes/admin.js`

---

## Access Control

- `AdminRoute` in `App.tsx` calls `GET /api/admin/me` on load — redirects to `/` if not admin
- `requireAdmin` middleware checks `ADMIN_EMAILS` env var first, then `admin_users` DB table
- Railway env var: `ADMIN_EMAILS=nir.dahan2001@gmail.com,dordavidm8@gmail.com,kickoffsportsapp@gmail.com`
- New admins added via dashboard are stored in `admin_users` table — take effect immediately, no redeploy needed

---

## Tabs

### 1. סקירה (Stats)

KPI cards:
- Total users (+ new today, + new this month)
- Total bets (+ pending, + live)
- Wins / losses + win rate
- Active leagues (+ total leagues)
- Total staked points (+ total paid out)
- Platform profit = total_staked − total_paid_out

Transactions by type table: type, count, volume (points)

---

### 2. משתמשים (Users)

- Search by username or email (live filter, up to 200 results)
- **Adjust points** — modal: amount (positive/negative) + reason text → `POST /admin/users/:id/adjust-points`
- **View bets** — modal: all user bets with status badges, cancel button for pending bets
- **Edit user** — modal: change username and/or display name → `PATCH /admin/users/:id`
- **Delete user** — confirmation required, permanent → `DELETE /admin/users/:id`
- **Unlink phone** — removes phone binding from user → `POST /admin/users/:id/unlink-phone`

---

### 3. הימורים (Bets)

- Status filter: all | pending | won | lost | cancelled
- Cancel button per row (pending only) — refunds stake, cancels associated parlay → `POST /admin/bets/:id/cancel`

---

### 4. משחקים (Games)

Sub-tabs: upcoming / finished

Filters:
- Team name search
- League (competition)
- Status (scheduled / live / finished / postponed)
- Blocked / open
- Odds source (espn / api / default / admin)
- Date range

Sortable columns: time, bet count, score

Per-row actions:
- **⭐ Feature game** — set bonus % and hours_before cutoff, live payout preview shown → `POST /admin/games/:id/feature`
- **Unfeature** — removes featured status → `DELETE /admin/games/:id/feature`
- **Lock / Unlock** — blocks or re-enables betting → `POST /admin/games/:id/lock` / `unlock`
- **Edit odds** — modal to override home/draw/away odds manually → `PATCH /admin/games/:id/odds`
- **Expand row (⌄)** — inline analytics: outcome breakdown (bet_count, total_staked, %) → `GET /admin/games/:id/analytics`

---

### 5. ליגות (Leagues)

- Search by league name or creator username
- Status filter: active | paused | finished
- **Pause league** — confirmation required → `POST /admin/leagues/:id/pause`
- **Stop league** — option to distribute prize pool or not → `POST /admin/leagues/:id/stop`
- **WhatsApp group** — per league: view/edit invite link, remove WA group → `POST/DELETE /admin/leagues/:id/wa-group`
- **Create public league** — form: name, description, format (pool / per_game), entry fee, max members
- Click row → navigates to `/leagues/:id` (read-only view in main app)

---

### 6. התראות (Notifications)

- Type: `admin_message` | `special_offer`
- Target: all users OR specific username
- Title + body → `POST /admin/notify`

---

### 7. אתגרים (Mini Games / Challenges)

Supported mini game types:
| ID | Name |
|----|------|
| `trivia` | טריוויה יומית (AI-generated) |
| `missing_xi` | Missing XI |
| `who_are_ya` | Who Are Ya? |
| `career_path` | Career Path |
| `box2box` | Box2Box |
| `guess_club` | Guess Club |

Workflow:
1. Select game type → configure options (trivia: category, custom topic, type free/premium)
2. Generate draft → preview result
3. Save to queue → `POST /admin/mini-game-draft`

Queue management:
- View all upcoming scheduled items
- Change play date → `PATCH /admin/mini-game-queue/:id`
- Delete from queue → `DELETE /admin/mini-game-queue/:id`

Each day the cron job pulls the first item in queue per category.

---

### 8. מתקדם (Advanced)

Four sub-sections:

**⚽ תחרויות**
- Table of all competitions
- Toggle `is_active` per competition → `PATCH /admin/competitions/:id/toggle`

**🔑 מנהלים**
- List current admins (env-based = ראשי label, DB-based = removable)
- Add admin by email → `POST /admin/admins`
- Remove admin → `DELETE /admin/admins/:email`

**🌐 תרגומי קבוצות**
- Table of pending AI-suggested Hebrew team name translations
- Approve → `POST /admin/team-translations/approve`
- Dismiss → `POST /admin/team-translations/dismiss`
- Regenerate bet questions → `POST /admin/regenerate-bet-questions`

**📋 לוג פעולות**
- Last 100 admin actions with Hebrew labels, admin email, and timestamp
- Actions logged: feature/unfeature game, cancel bet, adjust points, lock/unlock game, pause/stop league, add/remove admin, toggle competition

---

## Backend Routes

All routes require `requireAdmin` middleware.

```
GET    /admin/me
GET    /admin/stats
GET    /admin/users                        ?search=
POST   /admin/users/:id/adjust-points      { amount, reason }
PATCH  /admin/users/:id                    { username?, display_name? }
DELETE /admin/users/:id
POST   /admin/users/:id/unlink-phone
GET    /admin/users/:id/bets
GET    /admin/bets                         ?status=
POST   /admin/bets/:id/cancel
GET    /admin/games                        ?all=true
POST   /admin/games/:id/feature            { bonus_pct, hours_before }
DELETE /admin/games/:id/feature
POST   /admin/games/:id/lock
POST   /admin/games/:id/unlock
PATCH  /admin/games/:id/odds               { home_odds, draw_odds, away_odds }
GET    /admin/games/:id/analytics
GET    /admin/leagues
POST   /admin/leagues/:id/pause
POST   /admin/leagues/:id/stop             { distribute }
POST   /admin/leagues/:id/wa-group         { invite_link }
DELETE /admin/leagues/:id/wa-group
POST   /admin/notify                       { type, target, title, body }
GET    /admin/competitions
PATCH  /admin/competitions/:id/toggle
GET    /admin/admins
POST   /admin/admins                       { email }
DELETE /admin/admins/:email
GET    /admin/team-translations
POST   /admin/team-translations/approve    { name_en, name_he }
POST   /admin/team-translations/dismiss    { name_en }
POST   /admin/regenerate-bet-questions
GET    /admin/mini-game-draft              ?type=&category=&customTopic=&customType=
POST   /admin/mini-game-draft              { draft }
GET    /admin/mini-game-queue
PATCH  /admin/mini-game-queue/:id          { play_date }
DELETE /admin/mini-game-queue/:id
GET    /admin/log
```

---

## Database Tables

### `admin_users`
| Column | Type |
|--------|------|
| id | UUID PK |
| email | VARCHAR(200) UNIQUE |
| added_by | VARCHAR(200) |
| added_at | TIMESTAMPTZ DEFAULT NOW() |

### `admin_action_log`
| Column | Type |
|--------|------|
| id | UUID PK |
| admin_email | VARCHAR(200) |
| action | VARCHAR(100) |
| entity_type | VARCHAR(50) |
| entity_id | VARCHAR(100) |
| details | JSONB |
| created_at | TIMESTAMPTZ DEFAULT NOW() |

Index: `idx_admin_log_created` on `created_at DESC`

---

## Services

`backend/src/services/adminLogService.js`

```js
logAdminAction(adminEmail, action, entityType, entityId, details)
```

Called after every admin mutation. Action strings: `feature_game`, `unfeature_game`, `cancel_bet`, `adjust_points`, `lock_game`, `unlock_game`, `pause_league`, `stop_league`, `toggle_competition`, `add_admin`, `remove_admin`.
