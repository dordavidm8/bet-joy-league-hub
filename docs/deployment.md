# Deployment Guide

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
      "VITE_API_URL": "https://imaginative-surprise-production-4964.up.railway.app"
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
קובץ ריק – Railway מזהה Node.js אוטומטית.

### פקודת build + start
```json
// backend/package.json
"scripts": {
  "start": "node src/app.js",
  "dev": "nodemon src/app.js"
}
```

### גרסת Node
```json
"engines": { "node": ">=18" }
```
נדרש ≥18 בגלל Sharp (image processing).

### משתני סביבה (Railway Dashboard)
```
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-vercel-url.vercel.app
DATABASE_URL=postgresql://user:pass@host:5432/db

# Firebase Admin
FIREBASE_PROJECT_ID=kickoff-c1b6a
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@kickoff-c1b6a.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Admin access
ADMIN_EMAILS=nir@example.com,admin2@example.com

# AI Advisor
GROQ_API_KEY=gsk_...

# Dev mode (mock data instead of real API)
STUB_MODE=false
```

---

## Database – PostgreSQL on Railway

### הרצת הסכמה לראשונה
```bash
cd backend
node src/db/migrate.js
# או ישירות:
psql $DATABASE_URL -f src/db/schema.sql
```

### גיבוי
Railway מציע snapshot אוטומטי. לגיבוי ידני:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

---

## Firebase

### Firebase Console הגדרות נדרשות

1. **Authentication** → Enable providers:
   - Email/Password
   - Google
   - Facebook

2. **Storage** → Rules:
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

3. **Service Account** → Generate Private Key → שמור ב-Railway env vars

---

## הרצה מקומית

### Frontend
```bash
cp .env.local.example .env.local
# מלא את ה-Firebase credentials
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
cd backend && node src/db/migrate.js
```

---

## CI/CD

- **Vercel** – deploy אוטומטי על push ל-`main`
- **Railway** – deploy אוטומטי על push ל-`main`
- אין pipeline CI/CD נפרד כרגע

---

## Monitoring

- **Railway Logs** – לוגים של backend + cron jobs
- **Vercel Analytics** – page views, performance
- **Firebase Console** – auth events, errors

---

## CORS

```js
// backend/src/app.js
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}))
```

בפיתוח: `FRONTEND_URL=http://localhost:5173`
בייצור: `FRONTEND_URL=https://your-app.vercel.app`
