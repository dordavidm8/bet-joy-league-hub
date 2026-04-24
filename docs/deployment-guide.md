# מדריך פריסה – Kickoff

מסמך זה מסביר כיצד הפרויקט פרוס בסביבת production, אילו פלטפורמות משמשות, ואיך לבצע deploy.

---

## סקירת פריסה

```
┌──────────────────────────────────────────────────────────────┐
│                    תשתית Production                           │
│                                                              │
│  ┌─────────────────┐    ┌──────────────────────────────────┐ │
│  │   Vercel (CDN)  │    │         Railway                  │ │
│  │                 │    │  ┌────────────┐  ┌────────────┐  │ │
│  │  Frontend SPA   │◄──►│  │  Backend   │  │ PostgreSQL │  │ │
│  │  React + Vite   │    │  │  Express   │  │   DB       │  │ │
│  │  dist/ (static) │    │  │  port 4000 │  │            │  │ │
│  └─────────────────┘    │  └────────────┘  └────────────┘  │ │
│                          └──────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │   IONOS VPS (SSH – "shabbat")            │               │
│  │   WhatsApp Bot (Node.js + Puppeteer)     │               │
│  │   PM2 process manager                    │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │   Firebase (Google Cloud)                │               │
│  │   Authentication + Storage               │               │
│  └──────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Frontend – Vercel

### איפה?
**Vercel** – פלטפורמת hosting לאתרים סטטיים ו-SPA.  
URL: `https://bet-joy-league-hub.vercel.app`

### תצורה – `vercel.json`
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
- `VITE_API_URL` – URL של ה-backend ב-Railway (נקבע בזמן build)
- `rewrites` – כל URL מנותב ל-`index.html`. זה חיוני ל-SPA: כשמשתמש מנווט ל-`/leagues/123` ישירות, Vercel מחזיר את `index.html` ו-React Router מטפל בניתוב

### תהליך Deploy
```bash
# Vercel מתחבר ל-GitHub repository
# כל push ל-main מפעיל build אוטומטי:

npm run build      # Vite בונה → dist/
# Vercel מעלה את dist/ ל-CDN גלובלי
```

### env vars בפרונט
כל משתנה שמתחיל ב-`VITE_` מוזרק לבאנדל בזמן build (לא runtime):
```bash
VITE_API_URL=https://...railway.app
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=kickoff-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kickoff-app
VITE_FIREBASE_STORAGE_BUCKET=kickoff-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123...
```

⚠️ **חשוב:** משתני סביבה של Vite נכנסים לתוך הקוד הסטטי – **אל תכניס סודות** לשם!

---

## 2. Backend – Railway

### איפה?
**Railway** – פלטפורמת PaaS (Platform-as-a-Service) שמריצה containers.  
URL: `https://bet-joy-league-hub-production-6e04.up.railway.app`

Railway מנהל גם את **שרת ה-Express** וגם את **מסד הנתונים PostgreSQL** באותו project.

### תצורה – `backend/railway.json`
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
- **NIXPACKS** – Railway מזהה אוטומטית שזה Node.js ובונה container בהתאם (כמו `Dockerfile` אוטומטי)
- `npm run migrate && node src/app.js` – **לפני** שהשרת עולה, מריץ migrations. זה מבטיח שסכמת ה-DB תמיד מעודכנת
- `restartPolicyType: ON_FAILURE` – אם השרת קורס, Railway מנסה להפעיל שוב (עד 10 פעמים)

### מסד נתונים – PostgreSQL ב-Railway
Railway מספק PostgreSQL כ-add-on. החיבור דרך:
```bash
DATABASE_URL=postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway
```
משתנה זה מוזרק אוטומטית ל-service של הבאקנד ב-Railway.

### Migrations בהפעלה
```js
// backend/src/db/migrate.js
// מריץ את כל קבצי ה-.sql מתיקיית migrations/
// בודק אם כבר הורץ (טבלת schema_migrations)
```

```bash
# רצף ה-migration:
# 1. backend/src/db/schema.sql     ← DDL מלא (CREATE TABLE IF NOT EXISTS)
# 2. backend/src/db/migrations/    ← שינויים מצטברים
#    └── 20260421_advisor_admin.sql
#    └── 20260423_add_support_inquiries.sql
#    └── 2026_social_media_agents.sql
```

### env vars בבאקנד (Railway dashboard)
```bash
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://bet-joy-league-hub.vercel.app
DATABASE_URL=postgresql://...  # מוזרק אוטומטית על ידי Railway
FIREBASE_PROJECT_ID=kickoff-app
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@kickoff-app.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
ADMIN_EMAILS=nir.dahan2001@gmail.com
GROQ_API_KEY=gsk_...
THE_ODDS_API_KEY=...
STUB_MODE=false
SECRETS_MASTER_KEY=<32-byte hex>  # מפתח הצפנה ל-AES-256-GCM
```

### תהליך Deploy
```bash
# Railway מתחבר ל-GitHub
# כל push ל-main:
# 1. Nixpacks בונה container
# 2. מריץ: npm run migrate
# 3. מריץ: node src/app.js
# 4. מחכה ל-health check (GET /)
# 5. מחליף את ה-container הישן (zero-downtime)
```

---

## 3. WhatsApp Bot – VPS (IONOS)

### למה VPS ולא Railway?
`whatsapp-web.js` משתמש ב-**Puppeteer** (Chrome headless) כדי לדמות חיבור לוואטסאפ. Chrome צורך:
- ~200MB RAM רק לפתיחה
- חיבור מתמיד (session נשמרת)
- לא מתאים ל-container ephemeral של Railway שמתחיל ומסתיים

לכן הבוט רץ על **VPS קבוע** של IONOS עם Linux.

### פרטי Server
- **ספק:** IONOS (הוסטינג גרמני)
- **שם:** `shabbat` (alias ב-SSH config)
- **OS:** Ubuntu/Debian
- **User:** root
- **נתיב:** `/root/kickoff-bot/`

### גישה ל-Server
```bash
ssh shabbat
# מגיע ישירות ל-VPS
```

### PM2 – ניהול תהליך
**PM2** (Process Manager 2) מנהל את תהליך הבוט:

```js
// whatsapp-bot/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'kickoff-wa-bot',
    script: 'bot.js',
    cwd: '/app/whatsapp-bot',
    max_memory_restart: '400M', // restart אם עובר 400MB RAM
    restart_delay: 5000,         // 5 שניות בין restarts
    max_restarts: 10,
    env: { NODE_ENV: 'production' },
  }],
};
```

**פקודות PM2 שימושיות:**
```bash
pm2 status                    # הצג מצב כל התהליכים
pm2 logs kickoff-wa-bot       # הצג לוגים
pm2 restart kickoff-wa-bot    # הפעל מחדש
pm2 stop kickoff-wa-bot       # עצור
pm2 start ecosystem.config.js # הפעל לפי קובץ config
pm2 save                      # שמור config (לאחר reboot)
pm2 startup                   # הגדר auto-start בעת boot
```

### תהליך Deploy לבוט
```bash
# מה-Mac/PC המקומי:
ssh shabbat
cd /root/kickoff-bot/whatsapp-bot
git pull origin main
npm install --production
pm2 restart kickoff-wa-bot
```

### session WhatsApp
הבוט שומר session (כדי לא לסרוק QR בכל הפעלה):
```
whatsapp-bot/
├── .wwebjs_auth/     ← session data (LocalAuth)
└── .wwebjs_cache/    ← Chromium cache
```
⚠️ **אסור** למחוק תיקיות אלו – מחיקתן מחייבת סריקת QR מחדש.

### Internal API (Port 4001)
הבוט חושף Express server פנימי:
```js
// internalApi.js – port 4001
app.post('/send-message', auth, async (req, res) => {
  const { phone, message } = req.body;
  await client.sendMessage(`${phone}@c.us`, message);
});
```

הבאקנד ב-Railway שולח לכאן (דרך `WHATSAPP_BOT_URL` env var):
```js
// backend/src/services/whatsappBotService.js
await axios.post(`${BOT_URL}/send-message`, { phone, message }, {
  headers: { 'x-api-key': process.env.INTERNAL_API_KEY }
});
```

---

## 4. Firebase – Authentication + Storage

### Authentication
Firebase Auth מנהל את כל ההתחברות:
- Google OAuth
- Email/Password
- Anonymous (אורח)

**זרימה:**
```
המשתמש → Firebase SDK (client) → Google/Email auth
                                ↓
                         Firebase מחזיר ID Token (JWT)
                                ↓
הפרונט שולח Token → Backend מאמת ב-Firebase Admin SDK
```

**תצורת Firebase ב-frontend** (`lib/firebase.ts`):
```ts
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // ...
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

**אימות בבאקנד** (`config/firebase.js`):
```js
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })
});
```

### Storage
Firebase Storage משמש לאחסון **תמונות פרופיל**:
```tsx
// AvatarUploader.tsx
const storageRef = ref(storage, `avatars/${user.uid}`);
await uploadBytes(storageRef, file);
const url = await getDownloadURL(storageRef);
// שומר url ב-DB דרך backend
```

---

## 5. משתני סביבה – סיכום מלא

### Frontend (`.env.local` בפיתוח / Vercel env vars ב-production)
```bash
VITE_API_URL=http://localhost:4000              # dev
# VITE_API_URL=https://...railway.app          # prod (ב-vercel.json)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Backend (`backend/.env` בפיתוח / Railway env vars ב-production)
```bash
PORT=4000
NODE_ENV=development                            # או production
STUB_MODE=false                                 # true = DB מדומה
FRONTEND_URL=http://localhost:5173             # dev
DATABASE_URL=postgresql://user:pass@host/db
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
ADMIN_EMAILS=admin@example.com
GROQ_API_KEY=gsk_...
THE_ODDS_API_KEY=...
SECRETS_MASTER_KEY=<32-byte hex>
WHATSAPP_BOT_URL=http://localhost:4001         # dev / VPS URL בproduction
INTERNAL_API_KEY=<random secret>               # backend ↔ bot auth
```

### WhatsApp Bot (`whatsapp-bot/.env`)
```bash
DATABASE_URL=postgresql://...                  # same DB as backend
INTERNAL_API_KEY=<same as backend>
BOT_INTERNAL_PORT=4001
BOT_PHONE=972XXXXXXXXX                         # מספר הטלפון של הבוט
NODE_ENV=production
```

---

## 6. הרצה מקומית (Development)

### Frontend
```bash
cd bet-joy-league-hub
npm install
cp .env.local.example .env.local   # הגדר VITE_API_URL=http://localhost:4000
npm run dev                          # Vite dev server → http://localhost:5173
```

### Backend
```bash
cd backend
npm install
cp .env.example .env                 # הגדר DATABASE_URL וכו'
# אפשרות 1: עם PostgreSQL אמיתי
npm run migrate
node src/app.js

# אפשרות 2: ללא PostgreSQL (STUB_MODE)
STUB_MODE=true node src/app.js
```

**STUB_MODE** מחליף את ה-DB האמיתי בנתוני דמו מ-`config/stubDb.js` – שימושי לפיתוח UI ללא PostgreSQL מקומי.

### WhatsApp Bot
```bash
cd whatsapp-bot
npm install
cp .env.example .env
node bot.js                          # מציג QR לסריקה
# לאחר סריקה, הבוט מחובר
```

---

## 7. CI/CD ו-Zero-Downtime Deploy

### Frontend (Vercel)
- push ל-`main` → Vercel מזהה שינוי → build אוטומטי → deploy
- Zero-downtime: Vercel מחליף את ה-CDN edges ללא הפסקה
- Preview deployments: כל PR מקבל URL ייחודי לבדיקה

### Backend (Railway)
- push ל-`main` → Railway מזהה שינוי → Nixpacks build → deploy
- Zero-downtime: Railway מריץ את ה-container החדש לפני שמסיים את הישן
- Health check: Railway בודק שהשרת עונה לפני החלפה

### WhatsApp Bot (VPS – ידני)
```bash
# אין CD אוטומטי – deploy ידני:
ssh shabbat "cd /root/kickoff-bot/whatsapp-bot && git pull && pm2 restart kickoff-wa-bot"
```

---

## 8. בדיקת בריאות (Health Checks)

### Backend
```
GET https://...railway.app/        → Express מחזיר 200
```

### WhatsApp Bot
```
GET http://vps:4001/health         → { status: 'connected', ... }
```

```
GET /api/whatsapp/health           → הבאקנד בודק את הבוט ומחזיר סטטוס
```

---

## 9. עלויות משוערות

| שירות | תכנית | עלות משוערת |
|-------|-------|-------------|
| Vercel | Hobby (חינם) | $0/חודש |
| Railway | Starter | ~$5-20/חודש (לפי שימוש) |
| PostgreSQL (Railway) | Starter | כלול בתכנית Railway |
| Firebase | Spark (חינם) | $0 (בגבולות) |
| IONOS VPS | Basic | ~$5-10/חודש |
| ESPN API | ציבורי | $0 |
| The Odds API | Free tier | $0 (500 קריאות/חודש) |
| Groq API | Free tier | $0 (בגבולות) |

**סה"כ משוער: ~$10-30/חודש**

---

## 10. לוג שגיאות ומעקב

### Railway Logs
```bash
railway logs --service backend     # לוגים של הבאקנד
```

### PM2 Logs (VPS)
```bash
pm2 logs kickoff-wa-bot            # לוגים של הבוט
pm2 logs kickoff-wa-bot --lines 50 # 50 שורות אחרונות
```

### Admin Dashboard
הפרויקט כולל **Admin Dashboard** עם:
- סטטיסטיקות שימוש
- לוג פעולות מנהל (`admin_action_log` table)
- לוג שיחות יועץ AI (`advisor_events` table)
- היסטוריית pipeline מדיה חברתית

---

## סיכום

| רכיב | פלטפורמה | Deploy | URL |
|------|-----------|--------|-----|
| Frontend | Vercel | Git push → auto | bet-joy-league-hub.vercel.app |
| Backend | Railway | Git push → auto | *.up.railway.app |
| PostgreSQL | Railway | ניהול אוטומטי | (פנימי) |
| WhatsApp Bot | IONOS VPS | SSH + PM2 | (פנימי) |
| Auth/Storage | Firebase | ניהול Google | (console.firebase.google.com) |
