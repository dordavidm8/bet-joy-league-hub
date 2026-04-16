# ארכיטקטורה טכנית

## סטאק טכנולוגי

### Frontend
| טכנולוגיה | גרסה | שימוש |
|-----------|------|-------|
| React | 18.3 | UI framework |
| TypeScript | 5 | type safety |
| Vite | 8 | build tool / dev server |
| React Router | v6 | client-side routing |
| TanStack Query | v5 | server state + caching |
| Tailwind CSS | 3 | styling |
| Shadcn/ui + Radix | latest | component library |
| Framer Motion | latest | animations |
| Firebase JS SDK | latest | auth + storage |
| Recharts | latest | charts |
| React Hook Form + Zod | latest | forms + validation |

### Backend
| טכנולוגיה | גרסה | שימוש |
|-----------|------|-------|
| Node.js | ≥18 | runtime |
| Express.js | 4 | HTTP server |
| PostgreSQL | 15+ | database |
| Socket.io | 4 | real-time scores |
| Firebase Admin SDK | latest | token verification |
| Groq SDK | latest | AI advisor (LLaMA 3.1 8B) |
| node-cron | 3 | background jobs |
| Sharp | latest | image blurring (mini-games) |
| Cheerio | latest | HTML scraping |
| Axios | latest | HTTP client |
| Helmet | latest | CSP security headers |

### שירותים חיצוניים
| שירות | מטרה |
|-------|------|
| Firebase Auth | אימות משתמשים |
| Firebase Storage | תמונות פרופיל |
| ESPN API (חינמי) | משחקים, תוצאות, סיכויים |
| Groq | AI advisor |
| Wikidata / Wikipedia | נתוני שחקנים למיני-גיימס |
| flagcdn.com | דגלי קבוצות לאומיות |

---

## מבנה תיקיות

```
bet-joy-league-hub/
├── src/                        # React frontend
│   ├── pages/                  # 20 דפים (= routes)
│   ├── components/             # קומפוננטות UI + מיני-גיימס
│   │   └── minigames/          # 6 סוגי מיני-גיימס
│   ├── context/                # AuthContext, AppContext
│   ├── lib/                    # API client, Firebase config, types
│   ├── hooks/                  # Custom React hooks
│   ├── App.tsx                 # ניתוב ראשי
│   └── main.tsx                # entry point
├── backend/
│   └── src/
│       ├── app.js              # Express + Socket.io setup
│       ├── routes/             # 14 קבצי route
│       ├── services/           # business logic
│       ├── jobs/               # cron jobs
│       ├── middleware/         # auth, error handling
│       ├── config/             # DB, Firebase config
│       └── db/                 # schema.sql, migrations
├── docs/                       # תיעוד
├── context.md                  # הקשר פרויקט + ref API
├── tailwind.config.ts
├── vite.config.ts
├── vercel.json                 # Vercel deployment
└── railway.json                # Railway deployment
```

---

## זרימת נתונים

```
[Client Browser]
      │
      │  Firebase ID Token (JWT)
      ▼
[Vite Dev / Vercel CDN]
      │
      │  HTTPS + Authorization: Bearer <token>
      ▼
[Express Server (Railway)]
      │
      ├─ verifyFirebaseToken middleware
      │         │
      │         ├─ חוקי → מוסיף req.user
      │         └─ לא חוקי → 401
      │
      ├─ route handler
      │         │
      │         ├─ SELECT / INSERT (PostgreSQL pg)
      │         ├─ ESPN API (axios)
      │         └─ Groq API (AI advisor)
      │
      └─ JSON response
```

### Real-time (Live Scores)
```
[Server cron every 1min]
  → syncGames() → ESPN API
  → UPDATE games SET score=...
  → socket.io broadcast("game:update", data)

[Client] → useEffect subscribe to socket events
         → TanStack Query invalidate cache
```

---

## Authentication Flow

```
1. משתמש לוחץ "כניסה עם Google"
2. Firebase Auth popup → returns idToken
3. Frontend: POST /api/auth/register { idToken }
   → Backend: verifyIdToken(idToken) → firebase_uid
   → INSERT INTO users (firebase_uid, email, ...) ON CONFLICT DO UPDATE
4. AuthContext מאחסן את user object
5. כל API call: Authorization: Bearer <idToken>
6. Backend middleware: firebase_admin.auth().verifyIdToken()
```

### הרשאות
- **משתמש רגיל** – כל הפעולות הסטנדרטיות
- **אדמין** – email ברשימת `ADMIN_EMAILS` env → גישה לכל `/api/admin/*`

---

## Background Jobs (Cron)

| תדירות | Job | מה עושה |
|--------|-----|---------|
| כל דקה | `syncGames` | עדכון תוצאות חיות, נעילת שאלות |
| כל 5 דקות | `settleBets` | סגירת הניחושים, חלוקת נקודות |
| יומי 04:00 UTC | `syncGames` | רענון מלא של מאגר המשחקים |
| יומי 00:00 UTC | `generateAllMiniGames` | יצירת 5–6 חידות יומיות |
| יומי 06:00 UTC | `sendDailyChallengeReminder` | התראת קוויז יומי |
| שבועי שבת 21:00 UTC | `sendWeeklyLeaderboardBonus` | בונוס לוח מובילים |
| כל 15 דקות | `sendFeaturedMatchNotifications` | התראות משחק מוצג |

---

## אבטחה

- **Firebase Admin SDK** – אימות JWT בכל בקשה
- **Helmet** – Content Security Policy headers
- **CHECK constraints בDB** – יתרת נקודות לא יכולה לרדת מ-0
- **ADMIN_EMAILS** – רשימת emails מורשית לאדמין
- **Rate limiting** – AI advisor: 20 הודעות ליום למשתמש
- **Age verification** – אימות גיל 18+ ב-onboarding

---

## ביצועים

- **TanStack Query** – cache client-side, מינימום בקשות כפולות
- **Lazy loading** – דפים נטענים on-demand
- **Sharp** – עיבוד תמונות ב-server (blur) במקום בclient
- **Socket.io** – עדכוני ניקוד ב-push במקום polling
- **PostgreSQL indexes** – על firebase_uid, game_id, created_at
