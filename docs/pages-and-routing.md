# דפים וניתוב

React Router v6. כל הנתיבים מוגדרים ב-`src/App.tsx`.

---

## מפת הנתיבים

| נתיב | דף | תיאור |
|------|-----|-------|
| `/` | HomePage | דף הבית – משחקים מוצגים, upcoming, פיד |
| `/games` | AllGamesPage | כל המשחקים המתוכננים |
| `/games/finished` | FinishedGamesPage | תוצאות אחרונות |
| `/game/:gameId` | GameDetailPage | פרטי משחק + שאלות ניחוש + AI |
| `/betslip` | BetSlipPage | סל ניחושים (single + parlay) |
| `/bets` | BetHistoryPage | היסטוריית ניחושים |
| `/stats` | StatsPage | סטטיסטיקות מפורטות |
| `/leagues` | LeaguesPage | ליגות + לוח מובילים גלובלי + חיפוש |
| `/leagues/:leagueId` | LeagueDetailPage | פרטי ליגה + חברים |
| `/minigames` | MiniGamesHubPage | מרכז אתגרים יומיים |
| `/minigames/play/:id` | MiniGamePlayPage | חידה ספציפית |
| `/quiz` | QuizPage | קוויז יומי |
| `/expert` | ExpertChatPage | AI advisor |
| `/profile` | ProfilePage | פרופיל + הגדרות + הישגים |
| `/profile/:username` | PublicProfilePage | פרופיל ציבורי + follow |
| `/login` | LoginPage | כניסה (Google, Meta, Email) |
| `/onboarding` | OnboardingPage | אשף ראשוני למשתמש חדש |
| `/admin` | AdminDashboard | לוח בקרה (אדמין בלבד) |
| `*` | NotFound | 404 |

---

## Protected Routes

```tsx
// src/App.tsx
<Route element={<ProtectedRoute />}>
  <Route path="/betslip" element={<BetSlipPage />} />
  <Route path="/bets" element={<BetHistoryPage />} />
  <Route path="/leagues" element={<LeaguesPage />} />
  // ...כל שאר הדפים המחייבים התחברות
</Route>

<Route element={<AdminRoute />}>
  <Route path="/admin" element={<AdminDashboard />} />
</Route>
```

---

## Layout Structure

### דפים עם BottomTabBar
- HomePage, AllGamesPage, LeaguesPage, MiniGamesHubPage, ProfilePage

### דפים עם TopBar בלבד (ללא tabs)
- GameDetailPage, LeagueDetailPage, BetHistoryPage, QuizPage, ExpertChatPage, MiniGamePlayPage

### דפים ללא ניווט
- LoginPage, OnboardingPage

---

## דף הבית (HomePage)

סדר הרכיבים מלמעלה למטה:
```
TopBar (לוגו + NotificationBell)
├── Featured Games carousel (אם יש)
├── Nav buttons (משחקים / ליגות / אתגרים)
├── Upcoming Games (8 הקרובים ביותר)
└── Activity Feed (עם פילטר: כולם / עוקבים)
```

---

## דף משחק (GameDetailPage)

```
TopBar (חזרה + שם המשחק)
├── GameHeader (קבוצות + ניקוד + סטטוס)
├── BetQuestions (3 שאלות)
│   └── כל שאלה: 3 כפתורים + odds
├── AI Advisor (כפתור פתיחת chat)
└── BetSlip summary (אם יש ניחושים פתוחים)
```

---

## דף ליגות (LeaguesPage)

```
TopBar
├── Tabs: "הליגות שלי" | "לוח מובילים" | "חיפוש"
│
├── הליגות שלי:
│   ├── + צור ליגה חדשה
│   └── רשימת league cards
│
├── לוח מובילים:
│   └── Top 50 users
│
└── חיפוש:
    ├── שדה חיפוש username
    └── תוצאות + follow/unfollow
```

---

## דף אדמין (AdminDashboard)

```
Tabs (8):
1. Overview  – KPIs + גרפים
2. Users     – טבלה + חיפוש + adjust points
3. Games     – ניהול משחקים + feature
4. Bets      – ניתוח ניחושים
5. Leagues   – רשימת ליגות
6. Quiz      – ניהול שאלות + AI generate
7. Notifications – שליחת הודעות
8. Log       – admin_action_log
```
