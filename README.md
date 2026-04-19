# Kickoff ⚽

פלטפורמת הימורי כדורגל חברתית — הצב תחזיות, צבור נקודות והתחרה עם חברים בליגות פרטיות.

## טכנולוגיות

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| State / Cache | TanStack Query (React Query) |
| Auth | Firebase Authentication (email, Google) |
| Backend | Node.js + Express |
| Database | PostgreSQL (Railway) |
| Hosting | Frontend → Vercel · Backend → Railway |
| Data | ESPN public API (fixtures) · The Odds API (betting odds) |
| AI | Groq (llama-3.3-70b) — bet advisor |
| Notifications | WhatsApp (Baileys bot) |

## מבנה הפרויקט

```
bet-joy-league-hub/
├── src/                        # React frontend
│   ├── components/             # UI components (TopBar, etc.)
│   ├── context/                # AuthContext, NotificationContext
│   ├── lib/                    # API client, teamNames, firebase
│   ├── pages/                  # Route-level pages
│   └── main.tsx
├── backend/
│   ├── src/
│   │   ├── routes/             # Express routers (games, leagues, bets, admin, whatsapp…)
│   │   ├── services/           # sportsApi, whatsappBotService, aiAdvisor
│   │   ├── jobs/               # syncGames cron job
│   │   └── config/             # database, firebase-admin
│   └── index.js
├── public/                     # Static assets (logos, favicon)
└── index.html
```

## משתני סביבה

### Frontend (`.env`)
```
VITE_API_URL=https://your-backend.railway.app
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

### Backend (Railway env vars)
```
DATABASE_URL=postgresql://...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
THE_ODDS_API_KEY=...
WHATSAPP_BOT_URL=http://localhost:3001   # optional
STUB_MODE=false
```

## פיתוח מקומי

```bash
# Frontend
npm install
npm run dev

# Backend
cd backend
npm install
node index.js
```

## תכונות עיקריות

- **ליגות פרטיות** — צור ליגה, הזמן חברים, ניהול טורנירים
- **הימורים על משחקים** — תחזית מנצח, BTTS, מעל/מתחת, תוצאה מדויקת
- **דירוג ותחרות** — טבלת ניקוד לפי ליגה ועם חברים
- **יועץ AI** — המלצות הימורים מבוססות סטטיסטיקה (Groq)
- **התראות WhatsApp** — עדכוני משחקים ותוצאות דרך בוט
- **לוח ניהול** — ניהול משתמשים, תרגומי שמות, ניפוי סיכויי הימורים

## זרימת נתונים

```
ESPN API ──► syncGames job ──► PostgreSQL
                                    │
The Odds API ──► fetchAllOdds() ────┤
                                    │
                            Express API ──► React frontend
                                    │
                            Firebase Auth ──► JWT verify
```
