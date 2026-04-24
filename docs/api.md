# עיון ב-API – API Reference

כתובת בסיס: `https://bet-joy-league-hub-production-6e04.up.railway.app/api`

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

## Users (משתמשים)

### GET /users/search?q=username
חיפוש משתמשים לפי username (לצורך הזמנה לליגה / follow).

### GET /users/me/stats
סטטיסטיקות ההימורים של המשתמש המחובר.

### GET /users/me/bets?page=1&status=won
היסטוריית ההימורים (paginated). status: pending | won | lost | cancelled

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

## Games (משחקים)

### GET /games?status=live&competition=12&featured=true
```
params:
  status       – scheduled | live | finished | cancelled
  competition  – מזהה תחרות
  featured     – true/false
  from         – תאריך ISO
  to           – תאריך ISO
  limit        – ברירת מחדל 20
  offset       – pagination
```

### GET /games/live
כל המשחקים החיים כרגע.

### GET /games/results
תוצאות אחרונות (status=finished).

### GET /games/:id
פרטי משחק + שאלות הימור.

### GET /games/team-translations
תרגומי שמות קבוצות EN↔HE (מאושרים בלבד).

---

## Bets (הימורים)

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
פרטי הימור ספציפי.

### GET /bets?userId=...
כל הימורי משתמש.

---

## Leagues (ליגות)

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
פרטי ליגה + חברים + standings.

### POST /leagues/join
```json
body: { "invite_code": "ABC123" }
```

### POST /leagues/:id/leave
עזיבת ליגה.

### POST /leagues/:id/settle
סגירת ליגה וחלוקת פרסים (יוצר בלבד).

### GET /leagues/:id/leaderboard
טבלת דירוג של הליגה.

### POST /leagues/:id/invite
```json
body: { "username": "john_doe" }
```

---

## Leaderboard (טבלת דירוג)

### GET /leaderboard/global
50 המובילים לפי points_balance.

### GET /leaderboard/me
דירוג המשתמש המחובר + משתמשים סביבו.

---

## Quiz (טריוויה)

### GET /quiz/next
השאלה הבאה שלא נענתה על ידי המשתמש.

### POST /quiz/:id/answer
```json
body: { "selected_option": "A" }
response: { "is_correct": true, "points_earned": 50, "correct_option": "A" }
```

---

## AI Advisor (יועץ AI)

### POST /advisor/:gameId
```json
body: { "message": "מה הסיכויים שמנצ'סטר סיטי תנצח?" }
response: { "reply": "...", "messages_left": 17 }
```
מגבלה: 20 הודעות ליום לכל משתמש.

### GET /advisor/:gameId/stream?messages=...
תגובת AI בזמן אמת (Server-Sent Events / SSE streaming).

---

## Mini-Games (מיני-גיימס)

### GET /minigames/today
כל החידות של היום (5 אובייקטים, סוג אחד לכל סוג).

### POST /minigames/:id/submit
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

## Notifications (התראות)

### GET /notifications
כל ההתראות של המשתמש (ממוינות לפי created_at DESC).

### POST /notifications/:id/mark-read
סימון התראה כנקראה.

---

## Feed (פיד)

### GET /feed?filter=following&limit=20
```
params:
  filter  – all (ברירת מחדל) | following
  limit   – ברירת מחדל 20
  offset  – pagination
```

---

## Support (תמיכה)

### POST /support/inquiries
יצירת פנייה לתמיכה.
```json
body: { "subject": "...", "message": "..." }
```

### GET /support/inquiries
פניות התמיכה של המשתמש הנוכחי.

---

## WhatsApp

### POST /whatsapp/webhook
קבלת הודעות מהבוט (מאובטח עם API key).

### POST /whatsapp/send-message
שליחת הודעה דרך הבוט.

### GET /whatsapp/health
בדיקת חיבור הבוט.

---

## Admin (מנהל בלבד)

### GET /admin/stats
נתוני dashboard: משתמשים פעילים, הימורים, הכנסה.

### GET /admin/users?search=nir
רשימת משתמשים עם אפשרות חיפוש.

### POST /admin/users/:id/adjust-points
```json
body: { "amount": 500, "reason": "פרס מיוחד" }
```

### POST /admin/notify
```json
body: {
  "user_id"?: "uuid",        // null = כל המשתמשים
  "type": "admin_message",
  "title": "...",
  "body": "..."
}
```

### GET /admin/bets
סקירת הימורים.

### POST /admin/games/:id/feature
```json
body: { "bonus_pct": 15, "hours_before": 2 }
```

### DELETE /admin/games/:id/feature
הסרת featured.

### GET /admin/games/:id/analytics
ניתוח משחק ספציפי.

### PATCH /admin/competitions/:id/toggle
הפעלה/כיבוי תחרות.

### GET /admin/log
יומן פעולות מנהל (100 אחרונות).

---

## Ops

### POST /ops/generate-minigames
ייצור ידני של חידות (מנהל).

### POST /ops/reset-minigame-attempts
איפוס ניסיונות חידות (לפיתוח).

---

## Socket.io Events (עדכונים בזמן אמת)

### לקוח → שרת
```js
socket.emit('subscribe_game', { gameId: 'uuid' })
socket.emit('unsubscribe_game', { gameId: 'uuid' })
```

### שרת → לקוח
```js
socket.on('game:update', (data) => {
  // { gameId, homeScore, awayScore, status, minute }
})
```
