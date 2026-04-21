# תשתית ושירותים — Kickoff

מסמך זה מסביר את שלושת השירותים המרכזיים עליהם רץ האתר, מה תפקידו של כל אחד, ואיך הם עובדים ביחד.

---

## סקירת ארכיטקטורה

```
┌─────────────────────────────────────────────────────┐
│                     משתמש קצה                        │
└─────────────────────────────────────────────────────┘
          │ HTTPS                        │ WhatsApp
          ▼                              ▼
┌──────────────────┐           ┌──────────────────────┐
│     VERCEL       │           │      VPS (IONOS)      │
│  Frontend React  │           │   WhatsApp Bot (PM2)  │
│  Port: 80/443    │           │   Port: 4001 (פנימי)  │
└────────┬─────────┘           └──────────┬────────────┘
         │ REST API / Socket.io            │ PostgreSQL
         ▼                                ▼
┌──────────────────────────────────────────────────────┐
│                    RAILWAY                            │
│  ┌─────────────────────┐  ┌──────────────────────┐  │
│  │  Backend (Express)  │  │  PostgreSQL Database  │  │
│  │  Port: 4000         │  │  Port: 5432           │  │
│  └─────────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 1. Vercel — פרונטאנד

### מה זה?
Vercel הוא שירות hosting מתמחה ב-frontend. הוא אחראי על הגשת ממשק המשתמש (ה-React app) לכל גולש שנכנס לאתר.

### מה רץ שם?
- **React 18** + **TypeScript** — ממשק המשתמש המלא
- **Vite** — כלי build שמייצר קבצי HTML/JS/CSS סטטיים
- **Tailwind CSS** + **shadcn/ui** — ספריות עיצוב
- **Firebase SDK** — אימות משתמשים (Google Login)

### קובץ קונפיגורציה: `vercel.json`
```json
{
  "build": {
    "env": {
      "VITE_API_URL": "https://bet-joy-league-hub-production-6e04.up.railway.app"
    }
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**הסבר:**
- `VITE_API_URL` — מצביע על כתובת ה-backend ב-Railway בזמן build
- `rewrites` — הפניית כל נתיב ל-`index.html` כדי ש-React Router יוכל לנהל ניווט בצד לקוח (SPA routing)

### משתני סביבה (Vercel Dashboard)
| משתנה | תפקיד |
|-------|--------|
| `VITE_API_URL` | כתובת ה-backend ב-Railway |
| `VITE_FIREBASE_API_KEY` | מפתח Firebase לאימות |
| `VITE_FIREBASE_AUTH_DOMAIN` | דומיין Firebase (`kickoff-c1b6a.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | מזהה פרויקט Firebase (`kickoff-c1b6a`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage לתמונות |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging |
| `VITE_FIREBASE_APP_ID` | מזהה app ב-Firebase |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics |

### איך פריסה עובדת?
1. `git push` ל-`main` → Vercel מזהה שינוי אוטומטית
2. מריץ `vite build` — מייצר תיקיית `dist/`
3. מגיש את הקבצים הסטטיים מ-CDN גלובלי
4. זמן פריסה: ~1-2 דקות

### תרומה לאתר
- **זמינות גבוהה** — CDN גלובלי מבטיח טעינה מהירה מכל מקום בעולם
- **SSL אוטומטי** — HTTPS מנוהל לחלוטין על ידי Vercel
- **Preview Deployments** — כל branch מקבל URL ייחודי לבדיקה לפני מיזוג
- **Zero-config** — אין צורך לתחזק שרתי web, nginx, או תעודות SSL

---

## 2. Railway — Backend ו-Database

### מה זה?
Railway הוא פלטפורמת cloud המאחסנת את הלוגיקה העסקית של האתר ואת בסיס הנתונים. כל בקשת API מהפרונטאנד מגיעה לכאן.

### מה רץ שם?

#### שירות 1: Express Backend
- **Node.js** (≥18) עם **Express.js** — שרת HTTP
- **Socket.io** — תקשורת real-time (עדכוני תוצאות חיות)
- **Port 4000**
- כתובת production: `https://bet-joy-league-hub-production-6e04.up.railway.app`

#### שירות 2: PostgreSQL Database
- גרסה מנוהלת של PostgreSQL
- מחובר לשני השירותים האחרים (backend + WhatsApp bot) דרך connection string
- פורמט: `postgresql://postgres:PASSWORD@HOST:PORT/railway`

### קובץ קונפיגורציה: `backend/railway.json`
```json
{
  "$schema": "https://railway.app/railway-schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run migrate && node src/app.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**הסבר:**
- `NIXPACKS` — Railway מזהה אוטומטית שזה Node.js ומתקין את כל התלויות
- `startCommand` — בכל פריסה, מריץ קודם migration של ה-DB ואז מפעיל את השרת
- `restartPolicyType: ON_FAILURE` — אם השרת נפל, Railway מפעיל אותו מחדש אוטומטית (עד 10 פעמים)

### ה-API Routes
| Prefix | תפקיד |
|--------|--------|
| `/api/auth` | אימות משתמשים דרך Firebase |
| `/api/users` | ניהול פרופילים, נקודות, עדכונים |
| `/api/games` | נתוני משחקים, תוצאות |
| `/api/bets` | הגשת הימורים, חישוב ניקוד |
| `/api/leagues` | ניהול ליגות פרטיות |
| `/api/leaderboard` | טבלאות דירוג |
| `/api/quiz` | שאלות ידע |
| `/api/admin` | לוח ניהול (גישה מוגבלת) |
| `/api/advisor` | AI Advisor (Groq) |
| `/api/notifications` | מרכז ההתראות |
| `/api/whatsapp` | ממשק לבוט WhatsApp |
| `/api/minigames` | מיני-גיימס |
| `/api/feed` | פיד פעילות |
| `/health` | בדיקת תקינות השרת |

### תלויות עיקריות (`backend/package.json`)
| חבילה | תפקיד |
|--------|--------|
| `express` | שרת HTTP |
| `socket.io` | WebSockets ל-real-time |
| `pg` | חיבור ל-PostgreSQL |
| `firebase-admin` | אימות tokenים מ-Firebase |
| `groq-sdk` | AI Advisor (Groq LLM) |
| `node-cron` | משימות מתוזמנות (סגירת הימורים, חישוב תוצאות) |
| `sharp` | עיבוד תמונות |
| `helmet` | headers אבטחה |
| `morgan` | לוגינג של בקשות |

### משתני סביבה (Railway Dashboard)
| משתנה | תפקיד |
|-------|--------|
| `DATABASE_URL` | מחרוזת חיבור ל-PostgreSQL |
| `PORT` | פורט השרת (ברירת מחדל: 4000) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | כתובת ה-frontend לצורך CORS |
| `FIREBASE_CREDENTIAL_PATH` | נתיב ל-service account JSON |
| `ADMIN_UIDS` | רשימת UIDs של מנהלים |
| `GROQ_API_KEY` | מפתח ל-AI Advisor |
| `THE_ODDS_API_KEY` | מפתח ל-API של הסיכויים |
| `SECRETS_MASTER_KEY` | מפתח הצפנה פנימי |

### Database Schema
הסכמה מוגדרת ב-`backend/src/db/schema.sql` ומורצת אוטומטית בכל deploy דרך `backend/src/db/migrate.js`.

**טבלאות עיקריות:**
- `users` — משתמשים, נקודות, פרטי פרופיל
- `competitions` — תחרויות (ליגות פרמייר, UEFA וכו')
- `games` — משחקים, תוצאות
- `bets` / `parlays` — הימורים של משתמשים
- `bet_questions` — שאלות הימור לכל משחק
- `leagues` — ליגות פרטיות
- `league_members` — חברות בליגות
- `notifications` — התראות
- `admin_action_log` — לוג פעולות מנהל

> מפתחות ראשיים: UUID (עם pgcrypto extension)
> SSL: מופעל אוטומטית בסביבת production

### תרומה לאתר
- **לוגיקה עסקית מרכזית** — כל חישוב ניקוד, ניהול ליגות, ואימות הימורים
- **Real-time updates** — Socket.io מאפשר עדכון תוצאות ומצב ליגות ללא רענון דף
- **ניהול DB** — migrations אוטומטיות בכל פריסה, ללא downtime
- **Restart אוטומטי** — Railway מפעיל מחדש את השרת בקריסה בלי התערבות ידנית
- **PostgreSQL מנוהל** — גיבויים, scale, ותחזוקה מטופלים על ידי Railway

---

## 3. VPS (IONOS) — בוט WhatsApp

### מה זה?
VPS (Virtual Private Server) הוא שרת Ubuntu פרטי על IONOS. הוא מאחסן את בוט ה-WhatsApp של האתר — שירות שדורש session פיזי של WhatsApp Web ולכן לא יכול לרוץ על Railway.

### שם פנימי: `shabbat`

### מה רץ שם?
- **Node.js** + **whatsapp-web.js** — ספריית WhatsApp automation
- **Puppeteer** + **Chromium** — browser headless שמריץ WhatsApp Web
- **PM2** — מנהל תהליכים שמוודא שהבוט תמיד רץ
- **Express** — API פנימי על פורט 4001

### קובץ קונפיגורציה PM2: `whatsapp-bot/ecosystem.config.js`
```javascript
module.exports = {
  apps: [{
    name: 'kickoff-wa-bot',
    script: 'bot.js',
    cwd: '/app/whatsapp-bot',
    max_memory_restart: '400M',
    restart_delay: 5000,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
```

**הסבר:**
- `name: 'kickoff-wa-bot'` — שם התהליך ב-PM2
- `cwd: '/app/whatsapp-bot'` — תיקיית העבודה על השרת
- `max_memory_restart: '400M'` — אם הבוט מגיע ל-400MB RAM, PM2 מאתחל אותו אוטומטית
- `restart_delay: 5000` — המתנה של 5 שניות בין הפעלות מחדש
- `max_restarts: 10` — מקסימום 10 הפעלות מחדש לפני שמניח שיש בעיה קריטית

### למה לא Railway?
הבוט משתמש ב-**LocalAuth** — whatsapp-web.js שומר את session WhatsApp Web בתיקייה מקומית (`.wwebjs_auth/`). אם השרת נמחק ומופעל מחדש (כמו ב-Railway), ה-session נאבד ויש לסרוק QR code מחדש.
VPS נותן **אחסון קבוע** — הקבצים נשארים גם אחרי restart.

### תכונות הבוט
| תכונה | תיאור |
|--------|---------|
| **הודעות בוקר** | שולח תזכורות מוקדמות על משחקי היום |
| **תזכורות הימורים** | מתריע לפני סגירת הימורים |
| **טבלת דירוג** | שולח עדכוני leaderboard לקבוצות |
| **ניהול ליגות** | פקודות WhatsApp לניהול ליגות פרטיות |
| **DM handling** | מכונת מצבים לניהול שיחות פרטיות |
| **משימות מתוזמנות** | node-cron לתזמון פעולות יומיות |

### ה-API הפנימי (פורט 4001)
הבוט חושף REST API פנימי שה-backend ב-Railway קורא אליו כדי לשלוח הודעות WhatsApp.

```
GET  /health          — בדיקת תקינות הבוט
POST /send-message    — שליחת הודעה לאדם/קבוצה
POST /notify          — שליחת התראה לרשימת אנשי קשר
```

### משתני סביבה (`whatsapp-bot/.env`)
| משתנה | תפקיד |
|-------|--------|
| `DATABASE_URL` | חיבור ל-PostgreSQL ב-Railway (proxy URL) |
| `INTERNAL_API_KEY` | מפתח אימות לקריאות פנימיות מה-backend |
| `BOT_INTERNAL_PORT` | פורט ה-API הפנימי (4001) |
| `BOT_PHONE` | מספר הטלפון של חשבון ה-WhatsApp |
| `NODE_ENV` | סביבת הריצה |

### תהליך פריסה (ידני)
1. `ssh shabbat` — התחברות ל-VPS
2. `cd /app/whatsapp-bot && git pull` — עדכון קוד
3. `npm install` — התקנת תלויות חדשות
4. `pm2 restart kickoff-wa-bot` — הפעלה מחדש
5. `pm2 logs kickoff-wa-bot` — בדיקת לוגים

> **חשוב:** בפעם הראשונה אחרי session חדש, יש להריץ `node bot.js` ולסרוק QR code עם הטלפון, ואז `pm2 start ecosystem.config.js`.

### תרומה לאתר
- **ערוץ תקשורת נוסף** — משתמשים מקבלים עדכונים ישירות ל-WhatsApp
- **אוטומציה** — תזכורות ועדכונים ללא התערבות ידנית
- **Session קבוע** — VPS מבטיח שה-session לא נאבד בין הפעלות

---

## סיכום — מי אחראי על מה?

| שכבה | שירות | טכנולוגיה | ניהול פריסה |
|------|--------|-----------|-------------|
| **UI** | Vercel | React + Vite | אוטומטי (git push) |
| **API** | Railway | Node.js + Express | אוטומטי (git push) |
| **Database** | Railway | PostgreSQL | אוטומטי (migrate on deploy) |
| **WhatsApp Bot** | VPS (IONOS) | Node.js + whatsapp-web.js + PM2 | ידני (ssh + git pull) |

### זרימת בקשה טיפוסית
1. המשתמש פותח את האתר → Vercel מגיש את ה-React app
2. Firebase מאמת את המשתמש → מחזיר token
3. ה-React app שולח בקשה ל-backend ב-Railway עם ה-token
4. ה-backend מאמת את ה-token, מבצע לוגיקה, שואל/כותב ל-PostgreSQL
5. התשובה חוזרת ל-React ומוצגת למשתמש
6. **במקביל:** הבוט ב-VPS קורא מ-PostgreSQL ושולח עדכונים ל-WhatsApp לפי לוח זמנים
