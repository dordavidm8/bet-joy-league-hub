# API Reference

Base URL: `https://imaginative-surprise-production-4964.up.railway.app/api`

כל endpoint מלבד `/api/auth/register` דורש header:
```
Authorization: Bearer <firebase-id-token>
```

---

## Auth

### POST /auth/register
רישום / עדכון משתמש לאחר Firebase sign-in.
```json
body: { "idToken": "..." }
response: { "user": { "id", "username", "points_balance", ... } }
```

### GET /auth/me
מחזיר את המשתמש המחובר.

---

## Users

### GET /users/search?q=username
חיפוש משתמשים לפי username (לצורך הזמנה לליגה / follow).

### GET /users/me/stats
סטטיסטיקות הניחוש של המשתמש המחובר.

### GET /users/me/bets?page=1&status=won
היסטוריית הניחושים (paginated). status: pending | won | lost | cancelled

### GET /users/me/transactions
יומן עסקאות נקודות.

### GET /users/me/referral-code
קוד ה-referral הייחודי + קישור שיתוף.

### GET /users/me/detailed-stats
אחוז ניצחון לפי תחרות, מגמות חודשיות.

### GET /users/me/achievements
הישגים שנפתחו.

### GET /users/me/following
רשימת משתמשים שאני עוקב אחריהם.

### PATCH /users/me/profile
```json
body: { "username"?: "...", "display_name"?: "..." }
```

### PATCH /users/me/avatar
```json
body: { "avatar_url": "..." }
```

### DELETE /users/me
מחיקת חשבון.

### GET /users/:username
פרופיל ציבורי של משתמש אחר.

### POST /users/:username/follow
עקוב אחרי משתמש.

### DELETE /users/:username/follow
הפסק לעקוב.

---

## Games

### GET /games?status=live&competition=12&featured=true
```
params:
  status       – scheduled | live | finished | cancelled
  competition  – competition ID
  featured     – true/false
  from         – ISO date
  to           – ISO date
  limit        – default 20
  offset       – pagination
```

### GET /games/live
כל המשחקים החיים כרגע.

### GET /games/results
תוצאות אחרונות (status=finished).

### GET /games/:id
פרטי משחק + שאלות ניחוש.

---

## Bets

### POST /bets
```json
body: {
  "question_id": 42,
  "selected_option": "home",
  "stake": 100
}
response: { "bet_id", "potential_win", "live_penalty" }
```

### POST /bets/parlay
```json
body: {
  "selections": [
    { "question_id": 42, "selected_option": "home", "stake": 50 },
    { "question_id": 43, "selected_option": "over", "stake": 50 }
  ]
}
```

### GET /bets/:id
פרטי ניחוש ספציפי.

---

## Leagues

### POST /leagues
```json
body: {
  "name": "ליגת הפרצופים",
  "format": "tournament",       // pool | per_game | tournament
  "competition_id": 5,
  "entry_fee": 200,
  "stake_per_game": 50,
  "prize_distribution": [
    { "place": 1, "pct": 60 },
    { "place": 2, "pct": 30 },
    { "place": 3, "pct": 10 }
  ],
  "auto_settle": true
}
```

### GET /leagues/my/list
ליגות שאני חבר בהן.

### GET /leagues/:id
פרטי ליגה + חברים + סטנדינגס.

### POST /leagues/join
```json
body: { "invite_code": "ABC123" }
```

### POST /leagues/:id/leave
עזיבת ליגה.

### POST /leagues/:id/settle
סגירת ליגה וחלוקת פרסים (מנהל בלבד).

### GET /leagues/:id/matches
מחזורי משחקים בליגת tournament.

### POST /leagues/:id/invite
```json
body: { "username": "john_doe" }
```

---

## Leaderboard

### GET /leaderboard/global
50 המובילים לפי points_balance.

### GET /leaderboard/me
דירוג המשתמש המחובר.

---

## Quiz

### GET /quiz/next
השאלה הבאה שלא נענתה על ידי המשתמש.

### POST /quiz/:id/answer
```json
body: { "selected_option": "A" }
response: { "is_correct": true, "points_earned": 50, "correct_option": "A" }
```

---

## AI Advisor

### POST /advisor/:gameId
```json
body: { "message": "מה הסיכויים שמנצ'סטר סיטי תנצח?" }
response: { "reply": "...", "messages_left": 17 }
```
מגבלה: 20 הודעות ליום.

---

## Mini-Games

### GET /minigames/today
כל החידות של היום (5–6 אובייקטים).

### POST /minigames/:id/attempt
```json
body: { "answer": { ... } }  // מבנה לפי סוג החידה
response: { "is_correct": true, "points_earned": 80, "correct_answer": {...} }
```

### POST /minigames/box2box/verify
```json
body: { "cell": "0,1", "player_name": "Messi" }
response: { "valid": true }
```

---

## Notifications

### GET /notifications
כל ההתראות של המשתמש (ממוינות לפי created_at DESC).

### PATCH /notifications/:id/read
סימון התראה כנקראה.

### PATCH /notifications/read-all
סימון כל ההתראות כנקראות.

---

## Feed

### GET /feed?filter=following&limit=20
```
params:
  filter  – all (default) | following
  limit   – default 20
  offset  – pagination
```

---

## Admin (אדמין בלבד)

### GET /admin/stats
נתוני dashboard: משתמשים פעילים, הניחושים, הכנסה.

### GET /admin/users?search=nir
רשימת משתמשים עם אפשרות חיפוש.

### POST /admin/users/:id/adjust-points
```json
body: { "amount": 500, "reason": "פרס מיוחד" }
```

### POST /admin/notify
```json
body: {
  "user_id"?: 5,           // null = כל המשתמשים
  "type": "announcement",
  "title": "...",
  "body": "..."
}
```

### GET /admin/bets
סטטיסטיקות הניחושים.

### GET/POST/DELETE /admin/quiz
ניהול שאלות קוויז.

### POST /admin/quiz/generate
ייצור שאלה אוטומטית עם AI.

### POST /admin/games/:id/feature
```json
body: { "bonus_pct": 15 }
```

### DELETE /admin/games/:id/feature
הסרת featured.

### GET /admin/games/:id/analytics
ניתוח משחק ספציפי.

### PATCH /admin/competitions/:id/toggle
הפעלה/כיבוי תחרות.

### GET /admin/log
יומן פעולות אדמין.

---

## Ops

### POST /ops/generate-minigames
ייצור ידני של חידות (אדמין).

### POST /ops/reset-minigame-attempts
איפוס ניסיונות חידות (לפיתוח).

---

## Socket.io Events

### client → server
```js
socket.emit('subscribe_game', { gameId: 42 })
socket.emit('unsubscribe_game', { gameId: 42 })
```

### server → client
```js
socket.on('game:update', (data) => {
  // { gameId, homeScore, awayScore, status, minute }
})
```
