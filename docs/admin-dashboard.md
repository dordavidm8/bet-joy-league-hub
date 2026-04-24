# לוח ניהול – Admin Dashboard

## סקירה כללית

לוח הניהול הוא ממשק ניהול ייעודי למנהלי פלטפורמת Kickoff.  
נמצא בנתיב `/admin` (ללא AppLayout wrapper) עם כותרת משלו: "קיקאוף ניהול" + כפתור "חזור לאפליקציה".

- **Frontend:** `src/pages/AdminDashboard.tsx`
- **Backend routes:** `backend/src/routes/admin.js`

---

## בקרת גישה

- `AdminRoute` ב-`App.tsx` קורא ל-`GET /api/admin/me` בטעינה — מפנה ל-`/` אם לא מנהל
- Middleware `requireAdmin` בודק תחילה את env var `ADMIN_EMAILS`, ואז את טבלת `admin_users` ב-DB
- env var ב-Railway: `ADMIN_EMAILS=nir.dahan2001@gmail.com,admin2@example.com`
- מנהלים חדשים שנוספים דרך הדאשבורד מאוחסנים בטבלת `admin_users` — נכנסים לתוקף מיידית, ללא deploy מחדש

---

## לשוניות

### 1. סקירה (Stats)

כרטיסי KPI:
- סה"כ משתמשים (+ חדשים היום, + חדשים החודש)
- סה"כ הימורים (+ ממתינים, + חיים)
- ניצחונות / הפסדות + אחוז ניצחון
- ליגות פעילות (+ סה"כ ליגות)
- סה"כ נקודות שהוהמרו (+ סה"כ שולם)
- רווח פלטפורמה = total_staked − total_paid_out

טבלת עסקאות לפי סוג: type, count, volume (נקודות)

---

### 2. משתמשים

- חיפוש לפי שם משתמש או אימייל (מסנן חי, עד 200 תוצאות)
- **התאמת נקודות** — modal: סכום (חיובי/שלילי) + סיבה → `POST /admin/users/:id/adjust-points`
- **צפייה בהימורים** — modal: כל הימורי המשתמש עם badges של סטטוס, כפתור ביטול להימורים ממתינים
- **עריכת משתמש** — modal: שינוי שם משתמש ו/או שם תצוגה → `PATCH /admin/users/:id`
- **מחיקת משתמש** — דורש אישור, בלתי הפיך → `DELETE /admin/users/:id`
- **ניתוק טלפון** — מסיר קישור הטלפון של המשתמש → `POST /admin/users/:id/unlink-phone`

---

### 3. הימורים

- מסנן סטטוס: הכל | ממתין | ניצח | הפסיד | בוטל
- כפתור ביטול לכל שורה (ממתינים בלבד) — מחזיר stake, מבטל פרלי קשור → `POST /admin/bets/:id/cancel`

---

### 4. משחקים

תת-לשוניות: עתידיים / מסוימים

פילטרים:
- חיפוש שם קבוצה
- ליגה (תחרות)
- סטטוס (scheduled / live / finished / postponed)
- חסום / פתוח
- מקור odds (espn / api / default / admin)
- טווח תאריכים

עמודות הניתנות למיון: זמן, ספירת הימורים, ציון

פעולות לכל שורה:
- **⭐ Featured game** — הגדרת אחוז בונוס וזמן לפני (hours_before), תצוגה מקדימה של payout → `POST /admin/games/:id/feature`
- **הסרת featured** — `DELETE /admin/games/:id/feature`
- **נעילה / שחרור** — חסימה או שחרור של הימורים → `POST /admin/games/:id/lock` / `unlock`
- **עריכת odds** — modal לעקיפת odds ידנית (בית/שיוויון/חוץ) → `PATCH /admin/games/:id/odds`
- **הרחבת שורה (⌄)** — אנליטיקה inline: פירוט outcomes (bet_count, total_staked, %) → `GET /admin/games/:id/analytics`

---

### 5. ליגות

- חיפוש לפי שם ליגה או שם יוצר
- מסנן סטטוס: פעיל | מושהה | הסתיים
- **השהיית ליגה** — דורש אישור → `POST /admin/leagues/:id/pause`
- **עצירת ליגה** — אפשרות לחלק פרס pool או לא → `POST /admin/leagues/:id/stop`
- **קבוצת WhatsApp** — לכל ליגה: צפייה/עריכת קישור הזמנה, הסרת קבוצה WA → `POST/DELETE /admin/leagues/:id/wa-group`
- **יצירת ליגה ציבורית** — טופס: שם, תיאור, פורמט (pool / per_game), דמי כניסה, מקסימום חברים
- לחיצה על שורה → ניווט ל-`/leagues/:id` (תצוגה read-only באפליקציה הראשית)

---

### 6. התראות

- סוג: `admin_message` | `special_offer`
- יעד: כל המשתמשים OR שם משתמש ספציפי
- כותרת + גוף → `POST /admin/notify`

---

### 7. אתגרים (Mini Games)

סוגי מיני-גיימס נתמכים:
| ID | שם |
|----|-----|
| `trivia` | טריוויה יומית (מיוצר ב-AI) |
| `missing_xi` | Missing XI |
| `who_are_ya` | Who Are Ya? |
| `career_path` | Career Path |
| `box2box` | Box2Box |
| `guess_club` | Guess Club |

תהליך עבודה:
1. בחר סוג משחק → הגדר אפשרויות (טריוויה: קטגוריה, נושא מותאם, סוג חינמי/פרמיום)
2. ייצר טיוטה → תצוגה מקדימה של תוצאה
3. שמור לתור → `POST /admin/mini-game-draft`

ניהול תור:
- צפייה בכל הפריטים המתוכננים
- שינוי תאריך משחק → `PATCH /admin/mini-game-queue/:id`
- מחיקה מהתור → `DELETE /admin/mini-game-queue/:id`

בכל יום ה-cron job שולף את הפריט הראשון בתור לכל קטגוריה.

---

### 8. מתקדם

ארבעה תת-חלקים:

**⚽ תחרויות**
- טבלת כל התחרויות
- toggle `is_active` לכל תחרות → `PATCH /admin/competitions/:id/toggle`

**🔑 מנהלים**
- רשימת מנהלים נוכחיים (env-based = תווית "ראשי", DB-based = ניתן להסרה)
- הוספת מנהל לפי אימייל → `POST /admin/admins`
- הסרת מנהל → `DELETE /admin/admins/:email`

**🌐 תרגומי קבוצות**
- טבלת תרגומים עבריים שהוצעו על ידי AI וממתינים לאישור
- אישור → `POST /admin/team-translations/approve`
- דחייה → `POST /admin/team-translations/dismiss`
- ייצור מחדש שאלות הימור → `POST /admin/regenerate-bet-questions`

**📋 לוג פעולות**
- 100 פעולות ניהול אחרונות עם תוויות עבריות, אימייל מנהל, וחותמת זמן
- פעולות מתועדות: feature/unfeature game, cancel bet, adjust points, lock/unlock game, pause/stop league, add/remove admin, toggle competition

---

## Routes Backend

כל ה-routes דורשים middleware `requireAdmin`.

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

## טבלאות מסד נתונים

### `admin_users`
| עמודה | סוג |
|-------|-----|
| id | UUID PK |
| email | VARCHAR(200) UNIQUE |
| added_by | VARCHAR(200) |
| added_at | TIMESTAMPTZ DEFAULT NOW() |

### `admin_action_log`
| עמודה | סוג |
|-------|-----|
| id | UUID PK |
| admin_email | VARCHAR(200) |
| action | VARCHAR(100) |
| entity_type | VARCHAR(50) |
| entity_id | VARCHAR(100) |
| details | JSONB |
| created_at | TIMESTAMPTZ DEFAULT NOW() |

אינדקס: `idx_admin_log_created` על `created_at DESC`

---

## שירותים

**`backend/src/services/adminLogService.js`**

```js
logAdminAction(adminEmail, action, entityType, entityId, details)
```

נקרא לאחר כל פעולת ניהול. מחרוזות פעולה: `feature_game`, `unfeature_game`, `cancel_bet`, `adjust_points`, `lock_game`, `unlock_game`, `pause_league`, `stop_league`, `toggle_competition`, `add_admin`, `remove_admin`
