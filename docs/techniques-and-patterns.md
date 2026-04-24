# טכניקות ודפוסי תכנות – Kickoff

מסמך זה מסביר את הטכניקות, הספריות, וסגנונות הקוד שבהם משתמש הפרויקט. מטרתו לעזור להבין **למה** נבחר כל גישה ו**איך** היא עובדת בפועל.

---

## 1. ארכיטקטורת Frontend

### React + TypeScript
כל הפרונט כתוב ב-TypeScript עם React 18. TypeScript מוסיף טיפוסים סטטיים שמונעים שגיאות בזמן כתיבת הקוד ומשפרים את ה-autocomplete ב-IDE.

**דפוסים עיקריים:**
```tsx
// פונקצייה עם טיפוס props מוגדר
interface GameCardProps {
  game: Game;
  onBet: (gameId: string) => void;
}

const GameCard: React.FC<GameCardProps> = ({ game, onBet }) => {
  // ...
};
```

### Vite כמנהל build
במקום Create React App, הפרויקט משתמש ב-**Vite** שמהיר פי 10-50 ב-development (HMR מהיר). ה-build מייצר תיקיית `dist/` עם קבצים סטטיים מינימליים.

**path alias** מוגדר ב-`vite.config.ts`:
```ts
// מאפשר import מ-@ במקום נתיבים יחסיים
resolve: { alias: { "@": path.resolve(__dirname, "./src") } }
```

---

## 2. ניהול מצב (State Management)

### TanStack Query (React Query)
הפרויקט **לא** משתמש ב-Redux או Zustand. במקום זאת, **TanStack Query** מנהל את כל הנתונים שמגיעים מהשרת:

```tsx
// דוגמה מ-HomePage.tsx
const { data: games, isLoading } = useQuery({
  queryKey: ['games', 'live'],
  queryFn: getLiveGames,
  refetchInterval: 30_000, // רענון אוטומטי כל 30 שניות
  staleTime: 10_000,       // נתונים "טריים" ל-10 שניות
});
```

**יתרונות:**
- Cache אוטומטי – אם אותם נתונים מבוקשים שוב, מוחזרים מה-cache
- `refetchInterval` – רענון אוטומטי לנתונים חיים (משחקים, ציונים)
- Loading/Error states מובנים

### React Context לנתונים גלובליים
שני contexts מנהלים מצב גלובלי שלא קשור לשרת:

- **AuthContext** (`context/AuthContext.tsx`): מי המשתמש המחובר, טוקן Firebase
- **AppContext** (`context/AppContext.tsx`): מספר התראות לא-נקראות, הגדרות כלליות

```tsx
// שימוש ב-context
const { user, backendUser } = useAuth();
const { unreadCount } = useApp();
```

---

## 3. Authentication – Firebase + Backend JWT

**זרימת ההתחברות:**
```
1. המשתמש נכנס דרך Firebase (Google / Email)
2. Firebase מחזיר ID Token (JWT)
3. כל בקשה לבאקנד כוללת: Authorization: Bearer <token>
4. הבאקנד מאמת את הטוקן ב-Firebase Admin SDK
5. מחלץ uid ומביא את המשתמש מה-DB
```

```js
// backend/src/middleware/auth.js
const decodedToken = await admin.auth().verifyIdToken(token);
req.user = await pool.query('SELECT * FROM users WHERE firebase_uid = $1', [decodedToken.uid]);
```

**שכבות הגנה:**
- `authenticate` – חובה (כל endpoints מוגנים)
- `optionalAuthenticate` – אופציונלי (ניתן גם כאנונימי)
- `requireAdmin` – בדיקה ב-DB + env var

---

## 4. Real-Time – Socket.io + SSE

### Socket.io לציונים חיים
שרת ה-backend מריץ Socket.io לצד Express. ה-cron job `syncGames` מעדכן את הציונים ב-DB ואז שולח event לכל הלקוחות המחוברים:

```js
// כל לקוח מצטרף ל-room לפי gameId
socket.join(`game:${gameId}`);

// השרת מבצע broadcast לאחר עדכון ציון
io.to(`game:${gameId}`).emit('scoreUpdate', { homeScore, awayScore, minute });
```

### Server-Sent Events (SSE) ליועץ AI
תגובות ה-AI מגיעות **streaming** – כל מילה מתקבלת מיד כשה-LLM מייצר אותה, ולא לאחר שהתשובה המלאה מוכנה.

```js
// backend – שולח כל chunk בנפרד
res.setHeader('Content-Type', 'text/event-stream');
groqStream.on('chunk', (chunk) => {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
});

// frontend – מקבל chunk אחרי chunk
const eventSource = new EventSource(`/api/advisor/${gameId}/stream`);
eventSource.onmessage = (e) => setMessage(prev => prev + JSON.parse(e.data).text);
```

---

## 5. יועץ AI – Groq + Tool Use

### LLM Tool Use
היועץ לא רק עונה על שאלות – הוא **מבצע כלים** (tools) כדי לאסוף נתונים לפני שהוא עונה:

```js
// advisorTools.js – הגדרת tool
{
  name: 'fetch_recent_form',
  description: 'מביא 5 משחקים אחרונים של קבוצה',
  parameters: { team: { type: 'string' } }
}

// advisorService.js – הרצת tool
if (response.tool_calls) {
  const toolResult = await TOOL_FN_MAP[toolName](args);
  messages.push({ role: 'tool', content: toolResult });
  // ... קריאה נוספת ל-LLM עם התוצאה
}
```

**זרימה:** שאלת משתמש → LLM מחליט אם צריך tool → מריץ tool → שולח תוצאה ל-LLM → LLM עונה

### מגבלת שימוש (Rate Limiting)
כל משתמש מוגבל ל-20 הודעות ביום לשמירה על עלויות API:
```js
const { count } = await pool.query(
  `SELECT count FROM advisor_usage WHERE user_id = $1 AND date = CURRENT_DATE`,
  [userId]
);
if (count >= 20) throw new Error('הגעת למגבלת ההודעות היומית');
```

---

## 6. Cron Jobs – node-cron

ה-backend מריץ 9 cron jobs בתוך אותו תהליך (לא שרתים נפרדים):

```js
// jobs/index.js
cron.schedule('* * * * *',    syncGames);      // כל דקה
cron.schedule('*/5 * * * *',  settleBets);     // כל 5 דקות
cron.schedule('0 0 * * *',    generateMiniGames); // חצות
cron.schedule('0 6 * * *',    sendDailyReminder); // 6am UTC
cron.schedule('0 21 * * 6',   weeklyLeaderboard); // שבת 21:00
```

כל job עטוף ב-try/catch ולא קורס את השרת במקרה של שגיאה.

---

## 7. מסד הנתונים – PostgreSQL + pg

### Connection Pool
```js
// config/database.js
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```
Pool מנהל מספר חיבורים במקביל (default: 10). אין ORM – כל שאילתה כתובה ב-SQL ידני.

### Transactions לפעולות מורכבות
כשמניחים הימור, כל הפעולות חייבות להצליח יחד (atomicity):

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  // 1. בדוק שיש מספיק נקודות
  const user = await client.query('SELECT points_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
  if (user.rows[0].points_balance < stake) throw new Error('אין מספיק נקודות');
  
  // 2. הורד נקודות
  await client.query('UPDATE users SET points_balance = points_balance - $1 WHERE id = $2', [stake, userId]);
  
  // 3. צור הימור
  await client.query('INSERT INTO bets ...', [...params]);
  
  // 4. רשום עסקה
  await client.query('INSERT INTO point_transactions ...', [...params]);
  
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Parameterized Queries (מניעת SQL Injection)
```js
// בטוח – $1 מטוהר אוטומטית
pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// מסוכן – לעולם לא לכתוב כך:
pool.query(`SELECT * FROM users WHERE id = '${userId}'`); // ← XSS/injection
```

---

## 8. Live Penalty – מנגנון קנס הימורים חיים

זה אחד המנגנונים הייחודיים לפרויקט. כשמהמרים על משחק שכבר התחיל, מורידים אחוז מה-payout:

```js
// bettingService.js
const PENALTY_TIERS = [
  { from: 46, to: 60, penalty: 0.10 }, // 10%
  { from: 61, to: 70, penalty: 0.25 }, // 25%
  { from: 71, to: 75, penalty: 0.40 }, // 40%
];

function getLivePenalty(minute) {
  if (minute > 75) return null; // נעול – לא ניתן להמר
  const tier = PENALTY_TIERS.find(t => minute >= t.from && minute <= t.to);
  return tier?.penalty ?? 0;
}

// חישוב payout:
// payout = floor(stake × odds × (1 - penaltyPct))
```

---

## 9. ניהול מפתחות API – הצפנת AES-256-GCM

מפתחות API (Groq, The Odds API, וכו') מאוחסנים **מוצפנים** ב-DB, לא ב-env vars:

```js
// lib/crypto.js
const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
const encrypted = cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
// שומר: iv + authTag + encrypted (כל השלושה נחוצים לפענוח)

// lib/secrets.js
async function getSecret(name) {
  const row = await pool.query('SELECT encrypted_value FROM encrypted_secrets WHERE name = $1', [name]);
  return decrypt(row.encrypted_value, process.env.SECRETS_MASTER_KEY);
}
```

רק ה-SECRETS_MASTER_KEY (32 bytes) מאוחסן ב-env var של Railway.

---

## 10. תרגום שמות קבוצות EN↔HE

ה-ESPN API מחזיר שמות קבוצות באנגלית. הפרויקט מתרגם אותם לעברית:

**ב-backend** (`lib/teamNames.js`):
```js
const TEAM_NAMES = { 'Manchester City': 'מנצסטר סיטי', ... };
function translateTeam(name) {
  return TEAM_NAMES[name] ?? TEAM_NAMES[normalize(name)] ?? name;
}
```

**בפרונט** (`lib/teamNames.ts`):
- נטען פעם אחת מ-`/api/games/team-translations` (מה-DB)
- מאוחסן ב-memory ו-localStorage
- מיושם על כל שמות הקבוצות לפני תצוגה

---

## 11. Social Media Agents – Multi-Agent Pipeline

מערכת סוכנים שמייצרת פוסטים למדיה חברתית באופן אוטומטי:

```
orchestratorAgent
  ├── contentCalendarAgent   → מה הנושא השבועי?
  ├── growthStrategyAgent    → איזה זווית תצמיח?
  ├── contentCreatorAgent    → כתוב את הכיתוב
  ├── visualCreatorAgent     → תאר את התמונה
  ├── seoGeoAgent            → אופטם hashtags
  └── publisherAgent         → פרסם לפלטפורמות
```

כל סוכן:
1. מקבל **context object** עם נתוני הקשר (משחקים היום, בסיס ידע, זיכרון)
2. מבצע קריאת LLM עם פרומפט מותאם
3. מוסיף את התוצאה ל-context
4. מעביר לסוכן הבא

**Idempotency** – ה-orchestrator בודק אם כבר רץ היום לפני שמתחיל:
```js
const existing = await pool.query(
  'SELECT id FROM social_pipeline_runs WHERE run_date = CURRENT_DATE AND status = $1',
  ['completed']
);
if (existing.rows.length > 0) return { skipped: true };
```

---

## 12. WhatsApp Bot – מכונת מצבים (State Machine)

הבוט מנהל שיחות DM באמצעות מכונת מצבים שמאוחסנת ב-DB:

```js
// wa_sessions table: { phone, state, context (JSONB) }

// States: 'idle' | 'waiting_bet' | 'waiting_league' | 'confirm_bet'

// dmHandler.js
const session = await getSession(phone);
switch (session.state) {
  case 'idle':
    if (msg === 'הימור') await setState(phone, 'waiting_bet');
    break;
  case 'waiting_bet':
    // עיבוד הימור...
    await setState(phone, 'idle');
    break;
}
```

**הימורים דרך Reply:**
```
Bot שולח:  "מנצסטר סיטי vs ארסנל – מי ינצח?"
User עונה: "1" (reply לאותה הודעה)
Bot:       מזהה את ה-reply, מוצא את ID המשחק, מניח הימור
```

---

## 13. shadcn/ui – מערכת קומפוננטות UI

הפרויקט לא כותב קומפוננטות UI מאפס. **shadcn/ui** היא ספרייה שמספקת קומפוננטות מוכנות בסגנון Tailwind:

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
```

כל קומפוננטת UI נמצאת ב-`src/components/ui/` ו**היא חלק מהקוד של הפרויקט** – ניתן לשנות אותה. הן בנויות מעל **Radix UI** (primitives נגישים) עם Tailwind CSS לעיצוב.

---

## 14. Form Handling – React Hook Form + Zod

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  username: z.string().min(3, 'שם משתמש חייב להכיל לפחות 3 תווים'),
  email: z.string().email('כתובת מייל לא תקינה'),
});

const form = useForm({ resolver: zodResolver(schema) });
```

Zod מגדיר את סכמת הוולידציה, ו-React Hook Form מנהל את המצב של ה-form ומפעיל את הוולידציה.

---

## 15. Mobile-First Design

הפרויקט מתוכנן בעיקר למובייל:
- `max-w-lg mx-auto` – מרכוז תוכן ברוחב טלפון
- `BottomTabBar` – ניווט תחתון בסגנון mobile native
- `use-mobile.tsx` hook – זיהוי mobile לשינויי layout
- Tailwind responsive classes: `hidden md:block` לאלמנטים שמוצגים רק ב-desktop

---

## 16. Error Handling – שכבות הגנה

**Frontend:**
```tsx
// ErrorBoundary.tsx – לכידת שגיאות React
class ErrorBoundary extends React.Component {
  componentDidCatch(error) { console.error(error); }
  render() { return this.state.hasError ? <Fallback /> : this.props.children; }
}
```

**Backend:**
```js
// middleware/errorHandler.js – handler גלובלי
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status ?? 500).json({ error: err.message });
});

// כל route handler עטוף ב-try/catch שמעביר ל-handler הגלובלי:
router.get('/games', async (req, res, next) => {
  try { ... }
  catch(err) { next(err); } // ← next(err) מפעיל את errorHandler
});
```

---

## 17. Security Best Practices

| נושא | גישה |
|------|------|
| SQL Injection | Parameterized queries בכל מקום |
| XSS | React ממילא escape כל תוכן |
| Auth | Firebase JWT מאומת server-side |
| Admin | Double check: env var + DB table |
| API Keys | AES-256-GCM encryption ב-DB |
| Headers | Helmet middleware (CSP, HSTS, etc.) |
| CORS | רק origin של הפרונט מורשה |
| Rate Limit | הגבלת הודעות ביועץ AI (20/יום) |

---

## 18. ESPN API Integration

ה-backend מסנכרן נתוני משחקים מ-ESPN:

```js
// sportsApi.js
const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/scoreboard`;
const { data } = await axios.get(url, { params: { dates: dateRange, limit: 100 } });

// ממיר את מבנה ESPN לפורמט פנימי
const game = {
  espn_id: event.id,
  home_team: event.competitions[0].competitors.find(c => c.homeAway === 'home').team.displayName,
  score_home: parseInt(homeCompetitor.score ?? 0),
  status: mapStatus(event.status.type.name), // 'STATUS_IN_PROGRESS' → 'live'
};
```

---

## 19. Odds API Integration

```js
// oddsApi.js – The Odds API
const response = await axios.get('https://api.the-odds-api.com/v4/sports/soccer/odds', {
  params: { apiKey, regions: 'eu', markets: 'h2h,totals', oddsFormat: 'american' }
});

// המרה מ-American Odds ל-Decimal
function americanToDecimal(american) {
  return american > 0
    ? (american / 100) + 1      // +150 → 2.50
    : (100 / Math.abs(american)) + 1; // -200 → 1.50
}
```

---

## סיכום – דפוסים שחשוב לדעת לראיון

1. **SPA + REST API** – frontend ו-backend נפרדים לחלוטין
2. **JWT Auth** – Firebase מנפיק, backend מאמת
3. **React Query** – cache ו-refetch אוטומטיים לנתוני שרת
4. **Context API** – מצב גלובלי בלי Redux
5. **PostgreSQL Transactions** – atomicity לפעולות מורכבות
6. **Parameterized Queries** – מניעת SQL injection
7. **Cron Jobs** – background tasks בתוך שרת Express
8. **SSE Streaming** – תשובות AI בזמן אמת
9. **Tool Use (LLM)** – AI שמפעיל פונקציות לאיסוף נתונים
10. **AES-256-GCM** – הצפנת secrets ב-DB
