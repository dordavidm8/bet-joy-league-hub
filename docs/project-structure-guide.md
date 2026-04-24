# מדריך מבנה הפרויקט – Kickoff

**Kickoff** היא פלטפורמת הימורי ספורט חברתית שבה משתמשים מהמרים עם נקודות (לא כסף אמיתי) על משחקי כדורגל. הפרויקט מחולק לשלושה שירותים עצמאיים שרצים על תשתיות שונות.

---

## סקירת ארכיטקטורה

```
┌─────────────────────────────────────────────────────┐
│                     משתמש קצה                        │
│          דפדפן אינטרנט / WhatsApp Mobile             │
└────────────┬───────────────────────┬────────────────┘
             │                       │
             ▼                       ▼
┌────────────────────┐   ┌───────────────────────────┐
│   Frontend (React) │   │   WhatsApp Bot            │
│   Vercel CDN       │   │   VPS (IONOS / SSH)       │
│   port: 443 (HTTPS)│   │   port: 4001 (internal)   │
└────────┬───────────┘   └──────────┬────────────────┘
         │                          │
         │ HTTP REST / SSE          │ HTTP REST (internal key)
         ▼                          ▼
┌─────────────────────────────────────────────────────┐
│              Backend (Express + Node.js)             │
│              Railway – port 4000                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Routes    │  │   Services   │  │  Cron Jobs │ │
│  │ (17 routers)│  │ (19 files)   │  │ (9 files)  │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬─────┘ │
└─────────┼────────────────┼─────────────────┼───────┘
          │                │                 │
          ▼                ▼                 ▼
┌─────────────────────────────────────────────────────┐
│               PostgreSQL (Railway)                   │
│               40+ tables                            │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────┐
│     Firebase (Google)                  │
│  Authentication – JWT tokens           │
│  Storage – תמונות פרופיל              │
└────────────────────────────────────────┘
```

---

## עץ הפרויקט המלא

```
bet-joy-league-hub/
│
├── src/                          ← Frontend (React + TypeScript + Vite)
│   ├── App.tsx                   ← נקודת כניסה לראוטינג, גם בודק admin
│   ├── main.tsx                  ← ReactDOM.render, wraps ב-QueryClient
│   ├── index.css                 ← סגנונות גלובליים (Tailwind directives)
│   ├── vite-env.d.ts             ← טיפוסי Vite env
│   │
│   ├── pages/                    ← 20 עמודים, כל עמוד = route
│   │   ├── HomePage.tsx          ← דאשבורד: משחקים חיים, פיד, הישגים
│   │   ├── GameDetailPage.tsx    ← משחק בודד + שאלות הימור + יועץ AI
│   │   ├── BetSlipPage.tsx       ← בניית הימור (בודד / פרלי)
│   │   ├── BetHistoryPage.tsx    ← היסטוריית הימורים של המשתמש
│   │   ├── LeaguesPage.tsx       ← רשימת ליגות (שלי / ציבוריות)
│   │   ├── LeagueDetailPage.tsx  ← פרטי ליגה + טבלת דירוג
│   │   ├── ExpertChatPage.tsx    ← ממשק צ'אט עם יועץ AI
│   │   ├── MiniGamesHubPage.tsx  ← מרכז מיני-גיימס יומי (5 סוגים)
│   │   ├── MiniGamePlayPage.tsx  ← שחק מיני-גיים בודד
│   │   ├── AdminDashboard.tsx    ← לוח ניהול (מוגן תפקיד admin)
│   │   ├── ProfilePage.tsx       ← פרופיל + הגדרות + קוד הפניה
│   │   ├── PublicProfilePage.tsx ← פרופיל ציבורי של משתמש אחר
│   │   ├── QuizPage.tsx          ← שאלות טריוויה יומיות
│   │   ├── StatsPage.tsx         ← סטטיסטיקות הימור (ROI, win%, etc.)
│   │   ├── LoginPage.tsx         ← כניסה / הרשמה (Google + Email)
│   │   ├── OnboardingPage.tsx    ← מדריך למשתמש חדש
│   │   ├── AllGamesPage.tsx      ← חיפוש בכל המשחקים
│   │   ├── FinishedGamesPage.tsx ← תוצאות משחקים שהסתיימו
│   │   ├── HelpPage.tsx          ← שאלות נפוצות ותמיכה
│   │   ├── Index.tsx             ← redirect לדף הבית
│   │   └── NotFound.tsx          ← דף 404
│   │
│   ├── components/               ← קומפוננטות לפי תחום
│   │   ├── TopBar.tsx            ← כותרת עליונה (לוגו + ניווט)
│   │   ├── BottomTabBar.tsx      ← ניווט תחתון (מובייל)
│   │   ├── GameCard.tsx          ← כרטיס משחק מוצג (featured)
│   │   ├── GameListItem.tsx      ← שורת משחק ברשימה
│   │   ├── NotificationBell.tsx  ← פעמון התראות + תפריט
│   │   ├── AvatarUploader.tsx    ← העלאת תמונת פרופיל ל-Firebase Storage
│   │   ├── ErrorBoundary.tsx     ← לכידת שגיאות React וגיבוי
│   │   ├── ScrollToTop.tsx       ← גלילה לראש העמוד בניווט
│   │   ├── NavLink.tsx           ← קישור ניווט עם הדגשה פעיל
│   │   ├── AiAdvisor.tsx         ← ממשק צ'אט עם AI (streaming SSE)
│   │   │
│   │   ├── admin/                ← קומפוננטות לוח ניהול
│   │   │   ├── AdvisorTab.tsx    ← הגדרות יועץ AI
│   │   │   ├── SocialAgentTab.tsx← ניהול סוכני מדיה חברתית
│   │   │   ├── advisor/          ← 4 פאנלים פנימיים של היועץ
│   │   │   │   ├── ApiKeysPanel.tsx    ← ניהול מפתחות API מוצפנים
│   │   │   │   ├── ConfigPanel.tsx     ← מודל, טמפרטורה, פרומפט
│   │   │   │   ├── PlaygroundPanel.tsx ← בדיקת צ'אט בזמן אמת
│   │   │   │   └── StatsPanel.tsx      ← שימוש, tokens, עלות
│   │   │   └── social/           ← 8 קומפוננטות לסוכנים חברתיים
│   │   │       ├── AgentConfigModal.tsx    ← הגדרות סוכן
│   │   │       ├── AgentStatusGrid.tsx     ← סטטוס כל סוכן
│   │   │       ├── KnowledgeBaseManager.tsx← ניהול בסיס הידע
│   │   │       ├── LiveWorkFeed.tsx        ← לוג pipeline בזמן אמת
│   │   │       ├── MagicSwitchModal.tsx    ← toggle תכונות
│   │   │       ├── ManagementChat.tsx      ← צ'אט עם הסוכנים
│   │   │       ├── PostHistoryGallery.tsx  ← ארכיון פוסטים
│   │   │       └── SocialListeningFeed.tsx ← ניטור אזכורים
│   │   │
│   │   ├── minigames/            ← 7 קומפוננטות מיני-גיימס
│   │   │   ├── Box2BoxGame.tsx   ← חיבור שני שחקנים דרך קריירה משותפת
│   │   │   ├── CareerPathGame.tsx← ניחוש שלבי קריירת שחקן
│   │   │   ├── GuessClubGame.tsx ← ניחוש קבוצה מלוגו מטושטש
│   │   │   ├── MissingXIGame.tsx ← השלמת הרכב מהמשחק האחרון
│   │   │   ├── TriviaGame.tsx    ← שאלות טריוויה כדורגל
│   │   │   ├── WhoAreYaGame.tsx  ← ניחוש שחקן מתמונה מטושטשת
│   │   │   └── ResultModal.tsx   ← מסך תוצאה (ניצחת/הפסדת)
│   │   │
│   │   └── ui/                   ← 48 קומפוננטות shadcn/ui
│   │       └── (button, card, dialog, toast, form, input, etc.)
│   │
│   ├── context/                  ← מצב גלובלי של React
│   │   ├── AuthContext.tsx       ← auth + userData (Firebase + backend)
│   │   └── AppContext.tsx        ← notifications, הגדרות אפליקציה
│   │
│   ├── hooks/                    ← hooks מותאמים אישית
│   │   ├── useApi.ts             ← wrapper לקריאות API עם state
│   │   ├── use-mobile.tsx        ← זיהוי מסך מובייל (breakpoint)
│   │   └── use-toast.ts          ← hook לתצוגת toast
│   │
│   ├── lib/                      ← כלים ותצורות
│   │   ├── api.ts                ← כל קריאות ה-API (typed functions)
│   │   ├── firebase.ts           ← אתחול Firebase SDK
│   │   ├── teamNames.ts          ← תרגום שמות קבוצות EN↔HE
│   │   ├── mockData.ts           ← נתוני דמו למצב stub
│   │   └── utils.ts              ← פונקציות עזר כלליות (cn, etc.)
│   │
│   └── test/                     ← בדיקות
│       ├── example.test.ts       ← דוגמת בדיקת Vitest
│       └── setup.ts              ← תצורת סביבת בדיקה
│
├── backend/                      ← Backend (Node.js + Express)
│   └── src/
│       ├── app.js                ← שרת Express + Socket.io + cron
│       │
│       ├── config/               ← תצורות חיבור
│       │   ├── database.js       ← PostgreSQL connection pool
│       │   ├── firebase.js       ← Firebase Admin SDK
│       │   └── stubDb.js         ← DB מדומה לפיתוח (ללא PostgreSQL)
│       │
│       ├── db/                   ← ניהול סכמת מסד נתונים
│       │   ├── schema.sql        ← DDL מלא (40+ טבלאות, 490+ שורות)
│       │   ├── migrate.js        ← מריץ migrations בהפעלה
│       │   └── migrations/       ← קבצי SQL לשינויים מצטברים
│       │
│       ├── middleware/           ← middleware גלובלי
│       │   ├── auth.js           ← אימות Firebase JWT + בדיקת admin
│       │   └── errorHandler.js   ← handler שגיאות גלובלי
│       │
│       ├── routes/               ← 17 Express routers
│       │   ├── auth.js           ← POST /register, GET /me
│       │   ├── users.js          ← פרופיל, סטטיסטיקות, עסקאות
│       │   ├── games.js          ← משחקים, חיים, תוצאות
│       │   ├── bets.js           ← הימורים בודדים + פרלי
│       │   ├── leagues.js        ← ליגות: יצירה/הצטרפות/יציאה
│       │   ├── leaderboard.js    ← טבלת דירוג גלובלית + אישית
│       │   ├── quiz.js           ← שאלות טריוויה + הגשת תשובות
│       │   ├── minigames.js      ← מיני-גיימס יומיים (5 סוגים)
│       │   ├── advisor.js        ← יועץ AI (JSON + SSE streaming)
│       │   ├── admin.js          ← ניהול: סטטיסטיקות, משתמשים, לוגים
│       │   ├── notifications.js  ← התראות למשתמש
│       │   ├── feed.js           ← פיד פעילות חברתי
│       │   ├── support.js        ← קריאות תמיכה
│       │   ├── whatsapp.js       ← webhook לבוט WhatsApp
│       │   └── socialMedia.js    ← שליטה ב-pipeline סוכנים
│       │
│       ├── services/             ← לוגיקת עסקים (19 קבצים)
│       │   ├── bettingService.js      ← חישוב קנס live + payout
│       │   ├── sportsApi.js           ← ESPN API, odds, שאלות הימור
│       │   ├── oddsApi.js             ← The Odds API + cache
│       │   ├── advisorService.js      ← Groq LLM + tool use + SSE
│       │   ├── advisorTools.js        ← הגדרות tools ל-LLM
│       │   ├── advisorMetrics.js      ← לוגים של שימוש ב-LLM
│       │   ├── aiAdminService.js      ← AI לניהול (אימות מיני-גיימס)
│       │   ├── achievementService.js  ← מדליות והישגים
│       │   ├── notificationService.js ← שליחת התראות
│       │   ├── adminLogService.js     ← audit log פעולות מנהל
│       │   ├── whatsappBotService.js  ← גשר backend ↔ WhatsApp bot
│       │   └── social/                ← 12 סוכני מדיה חברתית
│       │       ├── orchestratorAgent.js      ← מתאם pipeline יומי
│       │       ├── contentCalendarAgent.js   ← תכנון נושא שבועי
│       │       ├── contentCreatorAgent.js    ← כתיבת כיתובים
│       │       ├── visualCreatorAgent.js     ← הנחיות תמונה/וידאו
│       │       ├── publisherAgent.js         ← פרסום לפלטפורמות
│       │       ├── growthStrategyAgent.js    ← אסטרטגיית צמיחה
│       │       ├── seoGeoAgent.js            ← אופטימיזציה גיאוגרפית
│       │       ├── analyticsAgent.js         ← ניתוח ביצועי פוסטים
│       │       ├── managementChatAgent.js    ← צ'אט ניהולי עם סוכנים
│       │       ├── socialMediaUtils.js       ← שאילתות DB + helpers
│       │       ├── unifiedMemoryService.js   ← זיכרון מצטבר של סוכנים
│       │       ├── promptLibraryService.js   ← ספריית תבניות פרומפט
│       │       └── nano-banana-templates.json← קובץ תבניות JSON
│       │
│       ├── jobs/                 ← Cron jobs (9 קבצים)
│       │   ├── index.js          ← אתחול + לוחות זמנים (node-cron)
│       │   ├── syncGames.js      ← כל דקה: ESPN → DB
│       │   ├── settleBets.js     ← כל 5 דקות: סגירת הימורים
│       │   ├── generateMiniGames.js← חצות: יצירת 5 פאזלים יומיים
│       │   ├── dailyReminder.js  ← 6:00 UTC: תזכורת טריוויה
│       │   ├── weeklyLeaderboard.js← שבת 21:00 UTC: נקודות בונוס
│       │   ├── featuredNotifications.js← כל 15 דקות: התראות משחק מוצג
│       │   ├── socialMediaPost.js← 5:00 UTC: pipeline מדיה חברתית
│       │   ├── socialAnalytics.js← 8:00 UTC: רענון מדדי engagement
│       │   └── socialListening.js← ניטור אזכורים ברשת
│       │
│       ├── middleware/
│       │   ├── auth.js           ← Firebase JWT verification + admin check
│       │   └── errorHandler.js   ← global error catching
│       │
│       ├── lib/                  ← כלי backend
│       │   ├── crypto.js         ← הצפנת AES-256-GCM
│       │   ├── secrets.js        ← ניהול מפתחות API מוצפנים ב-DB
│       │   └── teamNames.js      ← מילון תרגום שמות קבוצות
│       │
│       └── scripts/              ← סקריפטי תחזוקה חד-פעמיים
│           ├── cleanupTranslations.js ← מחיקת תרגומים ממתינים
│           └── syncUserStats.js       ← רענון סטטיסטיקות משתמשים
│
├── whatsapp-bot/                 ← בוט WhatsApp (Node.js)
│   ├── bot.js                    ← אתחול לקוח WhatsApp (whatsapp-web.js)
│   ├── ecosystem.config.js       ← תצורת PM2 לניהול תהליך
│   ├── nixpacks.toml             ← הגדרת build ל-Railway
│   │
│   └── src/
│       ├── handlers/             ← עיבוד הודעות נכנסות
│       │   ├── groupHandler.js   ← הודעות קבוצה (הימורים דרך reply)
│       │   ├── dmHandler.js      ← הודעות פרטיות (מכונת מצבים)
│       │   └── stateRouter.js    ← ניתוב לפי מצב שיחה
│       │
│       ├── commands/             ← פקודות בוט
│       │   ├── betCommands.js    ← הנחת/עדכון/צפייה בהימורים
│       │   ├── groupCommands.js  ← טבלת דירוג, הגדרות קבוצה
│       │   └── infoCommands.js   ← עזרה, חוקים, הצטרפות
│       │
│       ├── notifications/        ← שליחת הודעות יוזמות
│       │   ├── morningMessages.js    ← משחקי היום בבוקר
│       │   ├── resultNotifier.js     ← תוצאות משחקים
│       │   ├── leaderboardNotifier.js← טבלת הדירוג השבועית
│       │   └── reminderNotifier.js   ← תזכורות לפני נעילת הימורים
│       │
│       ├── scheduledJobs.js      ← cron jobs של הבוט
│       ├── internalApi.js        ← Express פנימי (port 4001)
│       ├── health.js             ← בדיקת בריאות
│       ├── rateLimiter.js        ← הגבלת קצב לפי משתמש/קבוצה
│       │
│       └── utils/                ← כלי עזר
│           ├── db.js             ← חיבור PostgreSQL
│           ├── formatters.js     ← עיצוב הודעות WhatsApp
│           ├── phoneUtils.js     ← פענוח מספרי טלפון
│           └── teamNames.js      ← תרגום שמות קבוצות
│
├── docs/                         ← תיעוד הפרויקט
│   ├── project-structure-guide.md   ← מסמך זה
│   ├── techniques-and-patterns.md   ← טכניקות וסגנונות קוד
│   ├── deployment-guide.md          ← מדריך פריסה
│   └── [קבצי תיעוד נוספים]
│
├── public/                       ← assets סטטיים (favicon, etc.)
├── index.html                    ← HTML entry point (Vite)
├── vite.config.ts                ← תצורת Vite + path aliases
├── tailwind.config.ts            ← תצורת Tailwind CSS
├── tsconfig.json                 ← תצורת TypeScript
├── vercel.json                   ← תצורת פריסה ל-Vercel
├── package.json                  ← dependencies + scripts (Frontend)
└── backend/
    ├── railway.json              ← תצורת פריסה ל-Railway
    └── package.json              ← dependencies (Backend)
```

---

## מדוע המבנה הזה?

### 1. הפרדת Frontend / Backend
הפרויקט הוא **Decoupled Architecture** – הממשק (React) והשרת (Express) הם שני שירותים נפרדים לחלוטין שמתקשרים דרך REST API. זה מאפשר:
- פריסה עצמאית (Vercel לפרונט, Railway לבאק)
- גמישות לשנות אחד מבלי לגעת בשני
- יכולת להוסיף לקוחות נוספים (מובייל, בוט) בעתיד

### 2. שכבות Backend (Routes → Services → DB)
```
HTTP Request → Route Handler → Service Layer → PostgreSQL
```
- **Routes** (`routes/`): מקבלות בקשה, מאמתות, קוראות לשירות, מחזירות תשובה
- **Services** (`services/`): הלוגיקה העסקית – חישובים, קריאות API חיצוניות, שאילתות DB
- **Config** (`config/`): חיבורים לתשתיות (DB, Firebase)

הפרדה זו מונעת כפילות קוד ומקלה על בדיקות.

### 3. Cron Jobs נפרדים (`jobs/`)
כל jobs רצות בתוך שרת ה-backend (לא שרת נפרד). הן אחראיות על:
- סנכרון נתוני משחקים מ-ESPN
- סגירת הימורים אוטומטית
- יצירת פאזלים יומיים
- שליחת התראות

### 4. Social Agents בתת-ספרייה (`services/social/`)
מערכת ה-pipeline של מדיה חברתית היא תת-מודול שלם בתוך services. ה-orchestratorAgent מתאם את כל שאר הסוכנים ברצף.

### 5. WhatsApp Bot כשירות נפרד
הבוט רץ על VPS נפרד (לא Railway) כי:
- whatsapp-web.js דורש Puppeteer (דפדפן headless) שצורך RAM רב
- הבוט צריך להיות online ללא הפסקה (אחרת session מאבד חיבור)
- PM2 ניהול תהליך מבטיח restart אוטומטי

---

## טבלאות מסד הנתונים המרכזיות

| קטגוריה | טבלאות עיקריות |
|----------|----------------|
| משתמשים | `users`, `point_transactions`, `user_follows`, `user_achievements` |
| משחקים | `games`, `competitions`, `bet_questions` |
| הימורים | `bets`, `parlays` |
| ליגות | `leagues`, `league_members`, `tournament_missed_bets` |
| מיני-גיימס | `daily_mini_games`, `mini_game_attempts` |
| טריוויה | `quiz_questions`, `quiz_attempts` |
| יועץ AI | `advisor_config`, `advisor_usage`, `advisor_events`, `encrypted_secrets` |
| מדיה חברתית | `social_posts`, `social_pipeline_runs`, `social_agent_config`, `social_unified_memory` |
| WhatsApp | `wa_groups`, `wa_sessions`, `wa_game_messages`, `wa_message_log` |
| ניהול | `admin_users`, `admin_action_log`, `support_inquiries` |
| תרגומים | `team_name_translations`, `notifications` |

---

## נתיבי API מרכזיים

| Prefix | Router | תיאור |
|--------|--------|-------|
| `/api/auth` | auth.js | הרשמה + כניסה |
| `/api/users` | users.js | פרופיל, סטטיסטיקות, הפניות |
| `/api/games` | games.js | משחקים, חיים, תוצאות |
| `/api/bets` | bets.js | הנחת הימורים |
| `/api/leagues` | leagues.js | ניהול ליגות |
| `/api/leaderboard` | leaderboard.js | טבלת דירוג |
| `/api/quiz` | quiz.js | טריוויה |
| `/api/minigames` | minigames.js | מיני-גיימס |
| `/api/advisor` | advisor.js | יועץ AI |
| `/api/admin` | admin.js | ניהול (מוגן) |
| `/api/notifications` | notifications.js | התראות |
| `/api/feed` | feed.js | פיד פעילות |
| `/api/support` | support.js | תמיכה |
| `/api/whatsapp` | whatsapp.js | webhook בוט |
| `/api/social` | socialMedia.js | pipeline מדיה חברתית |
