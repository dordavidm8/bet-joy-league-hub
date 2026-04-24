# מדריך פריסה – Deployment

> **הערה:** לתיעוד פריסה מפורט יותר ראה [deployment-guide.md](deployment-guide.md).

## סביבות

| סביבה | Frontend | Backend + DB |
|-------|----------|-------------|
| Production | Vercel | Railway |
| Development | `localhost:5173` | `localhost:4000` |

---

## Frontend – Vercel

### vercel.json
```json
{
  "build": {
    "env": {
      "VITE_API_URL": "https://bet-joy-league-hub-production-6e04.up.railway.app"
    }
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

ה-rewrite מכוון את כל הנתיבים ל-`index.html` (SPA routing).

### משתני סביבה (Vercel Dashboard)
```
VITE_API_URL=https://...railway.app
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=kickoff-c1b6a.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kickoff-c1b6a
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

---

## Backend – Railway

### railway.json
```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npm run migrate && node src/app.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### גרסת Node
```json
"engines": { "node": ">=18" }
```
נדרש ≥18 בגלל Sharp (עיבוד תמונות).

### משתני סביבה (Railway Dashboard)
```
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://bet-joy-league-hub.vercel.app
DATABASE_URL=postgresql://user:pass@host:5432/db
FIREBASE_PROJECT_ID=kickoff-c1b6a
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@kickoff-c1b6a.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
ADMIN_EMAILS=nir@example.com,admin2@example.com
GROQ_API_KEY=gsk_...
STUB_MODE=false
SECRETS_MASTER_KEY=<32 bytes hex>
```

---

## מסד נתונים – PostgreSQL ב-Railway

### הרצת הסכמה לראשונה
```bash
cd backend
npm run migrate
# או:
psql $DATABASE_URL -f src/db/schema.sql
```

### גיבוי
Railway מציע snapshot אוטומטי. לגיבוי ידני:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

---

## Firebase

### הגדרות נדרשות ב-Firebase Console

1. **Authentication** → הפעל ספקים:
   - Email/Password
   - Google

2. **Storage** → חוקים:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId}/{file} {
      allow read: if true;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

3. **Service Account** → ייצא Private Key → שמור ב-Railway env vars

---

## הרצה מקומית

### Frontend
```bash
cp .env.local.example .env.local
# מלא Firebase credentials
npm install
npm run dev
# → localhost:5173
```

### Backend
```bash
cd backend
cp .env.example .env
# מלא DATABASE_URL, Firebase creds, GROQ_API_KEY
npm install
npm run dev
# → localhost:4000
```

### Database (Docker)
```bash
docker run -d \
  --name kickoff-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=kickoff \
  -p 5432:5432 \
  postgres:15

export DATABASE_URL=postgresql://postgres:password@localhost:5432/kickoff
cd backend && npm run migrate
```

### מצב Stub (ללא DB)
```bash
STUB_MODE=true node src/app.js
```
מחליף את ה-DB האמיתי בנתוני דמו מ-`config/stubDb.js`.

---

## WhatsApp Bot – VPS (IONOS)

```bash
# deploy ידני:
ssh shabbat
cd /root/kickoff-bot/whatsapp-bot
git pull origin main
npm install --production
pm2 restart kickoff-wa-bot
```

לתיעוד מלא ראה [deployment-guide.md](deployment-guide.md).

---

## CI/CD

- **Vercel** – deploy אוטומטי על push ל-`main`
- **Railway** – deploy אוטומטי על push ל-`main`
- **WhatsApp Bot** – deploy ידני דרך SSH

---

## CORS

```js
// backend/src/app.js
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}))
```

- פיתוח: `FRONTEND_URL=http://localhost:5173`
- ייצור: `FRONTEND_URL=https://bet-joy-league-hub.vercel.app`
