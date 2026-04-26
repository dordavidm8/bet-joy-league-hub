# תיעוד מקיף – דפי Frontend (Pages)

> עודכן: 2026-04-24 | כיסוי: 21 קבצי דף + main.tsx + App.tsx

---

## main.tsx – נקודת כניסה ראשית

**תיאור כללי:**
נקודת כניסה ראשית של אפליקציית React. מאתחל את כל ה-providers הדרושים (QueryClient, AuthProvider, AppProvider) ורוטינג עם React Router.

**מטרה ותפקיד:**
- אתחול Root ReactDOM ב-HTML `#root`
- הגדרת Query Client עבור TanStack Query
- עטיפת האפליקציה עם פרוביידרים: `TooltipProvider`, `AppProvider`, `AuthProvider`, `BrowserRouter`

**תלויות:**
- **ייבוא:** React Router, TanStack Query, context providers, App component
- **ממצא:** כל הדפים עוברים דרכו

---

## App.tsx – ראוטינג ראשי

**תיאור כללי:**
קומפוננטת הראוטינג הראשית. מגדירה 20+ routes, בדיקות הרשאות, וטוען תרגומים של שמות קבוצות מהשרת.

**מטרה ותפקיד:**
- הגדרת כל המסלולים (routes) של האפליקציה
- ניהול גישה לפי סטטוס משתמש (guest, authenticated, admin)
- טעינה דינמית של תרגומי שמות קבוצות בעת ההפעלה

**תלויות:**
- **ייבוא:** כל הדפים, Auth/App Context, API functions, UI components
- **ממצא:** `main.tsx` עוטף את App

**קומפוננטות פנימיות:**

### `BlockedScreen()`
מסך שגיאה עבור משתמשים ללא הרשאת admin.
- מציג אייקון 🚫 + כפתור התנתקות

### `AdminRoute()`
בדיקת הרשאות admin דרך useQuery עם cache של 5 דקות.
- אם `isError` או `!is_admin` → redirect ל-"/" והצגת BlockedScreen

### `DynamicTranslationsLoader()`
טוען תרגומי שמות קבוצות מה-DB בעת ההפעלה.
```javascript
useQuery("team-translations", getApprovedTeamTranslations, { staleTime: 10 min })
// useEffect: קורא setDynamicTranslations(data) + invalidate כל queries של games
```
**הסבר לא ברור:** ה-invalidation מבטיח שהמשחקים המוצגים יציגו שמות בעברית גם אחרי שהתרגומים נטענו.

### `AppLayout({ children })`
Layout wrapper: TopBar + children + BottomTabBar + version badge.

### `AuthGate()`
שער האימות הראשי – קובע מה מוצג לפי מצב המשתמש:
```
loading?       → "טוען..."
!firebaseUser && !isGuest? → LoginPage
isGuest?       → Routes מוגבלות (בית, משחקים, ליגות ציבוריות בלבד)
!onboardingDone → OnboardingPage
else           → Full routes
```

---

## Index.tsx – הפניה לדף הבית

פשוט – re-export של `HomePage`. מסלול "/" נחת כאן.

---

## HomePage.tsx – דאשבורד ראשי

**תיאור כללי:**
דף בית עם: featured games בקרוסלה, משחקים חיים, רשימת משחקים קרובים, פיד פעילות חברתי, וסטטיסטיקות מהיר.

**תלויות:**
- **ייבוא:** `getGames`, `getLiveGames`, `getFeed`, `useAuth`, `GameCard`, `GameListItem`, `framer-motion`
- **ממצא:** ProfilePage (follow), GameDetailPage (click)

**פונקציות:**

### `timeAgo(dateStr: string): string`
מחזיר תיאור זמן יחסי: "עכשיו", "לפני 5 דק'", "לפני 2 שעות".

### `translateFeedDesc(desc: string): string`
מתרגם תיאורי פעילות מאנגלית לעברית. ("vs" → "נגד")

### useQuery – משחקים חיים
```javascript
queryKey: ["games", "live"], refetchInterval: 30_000
```
**הסבר:** ריענון כל 30 שניות לציוני live.

### useQuery – פיד פעילות
```javascript
queryKey: ["feed", feedFilter], staleTime: 60_000
```
- `feedFilter`: 'all' | 'following' (state בכפתור Toggle)

**Sections בתצוגה:**
- **Hero:** אנימציה Framer Motion
- **Live Games:** מוצג רק אם קיימים משחקים חיים
- **WhatsApp Prompt:** אם `!backendUser.phone_verified`
- **Editor's Pick:** משחקים עם `is_featured=true` בקרוסלה אופקית
- **Upcoming Games:** רשימת `GameListItem` (עד 8 משחקים)
- **Activity Feed:** עד 8 פעילויות, with toggle "הכל"/"עוקבים"
- **Quick Stats:** ניצחונות, אחוז הצלחה, סה"כ הימורים

---

## GameDetailPage.tsx – פרטי משחק

**תיאור כללי:**
דף עם פרטי משחק מלא, שאלות הימור עם odds, בחירת ליגה/context, ופתיחת AI Advisor.

**תלויות:**
- **ייבוא:** `getGame`, `getMyLeagues`, `useApp` (addToBetSlip), `AiAdvisor`, `framer-motion`
- **ממצא:** BetSlipPage (אחרי addToBetSlip)

**Hooks מותאמים:**

### `useBettingCountdown(startTime: string)`
Countdown timer עד 10 דקות לפני המשחק. מעדכן כל שנייה.
```
closesAt = startTime - 10 min
אם diff <= 0: return null
else: "הימורים ייסגרו בעוד X:YY"
```

**State מרכזי:**
```javascript
stakes: Record<questionId, string>      // סכום בנקודות
selections: Record<questionId, string>  // לייבל הבחירה
exactScores: Record<questionId, string> // תוצאה מדויקת X-Y
betContexts: Record<questionId, Set<string>> // "global" | leagueId
```

**פונקציות:**

### `toggleContext(questionId, ctx)`
הוסף/הסר context (ליגה או global) מ-Set של שאלה.

### `handleSelect(questionId, label)`
בחירת תוצאה → מגדיר selection, מאתחל contexts עם pre-selected league אם בא מעמוד ליגה.

### `getExactScoreError(score, selectedOutcome): string | null`
ולידציה של תוצאה מדויקת (פורמט X-Y + עקביות עם הבחירה).
- **הסבר:** אם בחרת "Real Madrid ינצח" ורשמת "0-2" – שגיאה.

### `handleAddToSlip(questionId)`
מוסיף לתלוש לפי הtype:
- `initial_balance`: `points=0, bet_mode="initial_balance"`
- `minimum_stake`: `points=stakes[q], bet_mode="minimum_stake"`
- `global`: `bet_mode="global"`, points מה-input

**League Filter:**
```javascript
activeLeagues = myLeagues.filter(l => l.is_active && l.status === "active"
  && (!l.tournament_slug || l.tournament_slug === game.competition_slug))
```
**הסבר:** ליגת טורניר (World Cup) מסוננת לפי תחרות ספציפית בלבד.

**AI Advisor Button:** Fixed bottom-24, נעול (🔒) אם לא admin.

---

## BetSlipPage.tsx – תלוש הימורים

**תיאור כללי:**
הנחת הימור סופי. תומך בהימורים בודדים ו-parlays. מחשב potential payout.

**תלויות:**
- **ייבוא:** `useApp` (betSlip), `useAuth`, `placeBet`, `placeParlay`, `framer-motion`

**פונקציות:**

### `parlayBonus(legs): number`
| Legs | Multiplier |
|------|-----------|
| 4+   | ×1.20     |
| 3    | ×1.15     |
| 2    | ×1.10     |
| 1    | ×1.00     |

### `calculateBetPotential(bet): number`
```
potential = stake × odds × multiplier × featuredMult
multiplier = 3 אם exact_score, 1 אחרת
featuredMult = 1 + (bonus_pct/100) אם featured
```

### `handleConfirm()`
1. בדיקת expiration (10 דקות לפני kickoff)
2. בדיקת יתרה מספקת
3. שליחת הימורים (parlay + remaining bets בנפרד)
4. יצירת shared message לWhatsApp
5. clearBetSlip + refreshUser

**Parlay Logic:**
```javascript
canParlay = freeBets.length >= 2 && freeBets.length === realBets.length && !duplicateQuestions
// freeBets = הימורים ללא league_id
// לא ניתן parlay אם יש הימורי ליגה
```

**UI:**
- Toggle Parlay (אם canParlay)
- רשימת הימורים עם trash icon
- Summary card (total stake, potential payout)
- Result state (success / error)

---

## BetHistoryPage.tsx – היסטוריית הימורים

**תיאור כללי:**
היסטוריה של כל הימורי המשתמש עם pagination, פילטור, חיפוש וביטול.

**תלויות:**
- **ייבוא:** `getMyBets`, `cancelBet`, `useQueryClient`

**State:**
```javascript
status: ""         // pending/won/lost/cancelled/parlay_failed
search: ""         // שם קבוצה
offset: 0          // pagination (PAGE_SIZE=20)
cancellingId: null // ID של הימור בביטול
```

**useQuery:** `queryKey: ["my-bets-full", status, search, offset]` – query חדש כל שינוי.

**הסבר לא ברור:** כאשר מבטלים parlay, מוצגת אזהרה שכל ה-legs יבוטלו.

**UI לכל הימור:**
- Competition + league badge + parlay number
- שמות קבוצות + תאריך
- שאלה + בחירה + odds + exact_score
- Stake + תוצאה (won/lost/pending)
- כפתורי ביטול (pending בלבד) + WhatsApp share (won בלבד)

---

## LeaguesPage.tsx – ניהול ליגות

**תיאור כללי:**
שני טאבים: "הליגות שלי" (יצירה/הצטרפות) ו-"לידרבורד גלובלי".

**תלויות:**
- **ייבוא:** `getMyLeagues`, `getLeaderboard`, `createLeague`, `joinLeague`, `getPublicLeagues`, `searchUsers`

**Create League State:**
```javascript
format: "pool" | "per_game"
isTournament: boolean
tournamentSlug: string    // "eng.1", "fifa.world" וכו'
stakePerMatch: string
distribution: [{ place, pct }]
joinPolicy: "before_start" | "anytime"
autoSettle: boolean
```

**Derived bet_mode:**
- `pool` → `initial_balance`
- `per_game` → `minimum_stake`

**Create League Form:**
- שם, תיאור, format toggle, tournament checkbox
- אם tournament: תחרות, stake למשחק, תאריך סיום, join policy, auto-settle
- distribution rows (validate: sum=100%)
- max members, entry fee

**Join Form:** קוד הזמנה עם uppercase conversion אוטומטי.

**Public Leagues Discovery:** ליגות ציבוריות שהמשתמש לא חבר בהן.

**Leaderboard Tab:**
- חיפוש משתמשים (live search dropdown)
- My rank card
- Top 50 משתמשים עם medals

---

## LeagueDetailPage.tsx – פרטי ליגה

**תיאור כללי:**
פרטי ליגה מלאים: דירוג, חברים, WhatsApp bot integration, משחקי טורניר, סגירת עונה.

**תלויות:**
- **ייבוא:** `getLeague`, `getLeagueMatches`, `settleLeague`, `leaveLeague`, `inviteToLeague`, WA settings API functions

**Mutations:** settle, leave, invite, waCreateGroup, waUnlink, waUpdateLink, waRefreshLink, waSaveSettings, waBroadcast

**UI Sections:**

**Invite Code Section:** קוד הזמנה + copy + WhatsApp share + live user search להזמנה.

**WhatsApp Bot Section (אם tournament && !finished && !public):**
- אם מחוברת: invite link management + admin settings (morning time, leaderboard frequency/time/day)
- אם לא מחוברת (creator): "צור קבוצת WhatsApp" או הוסף ידנית עם `/kickoff setup {code}`

**Prize Distribution:** טבלה אם יש distribution.

**League Leaderboard:** לפי `points_in_league DESC`, medals, highlight למשתמש נוכחי.

**Tournament Matches Section:**
- Summary bar: הימרתי / פספסתי / ממתין
- Tab: עתידיים / שהסתיימו
- לכל משחק: status icon, קבוצות, ציון, bet info, CTA

**Actions:** סגירת עונה (creator only) + עזיבת ליגה.

---

## ExpertChatPage.tsx – יועץ AI

**תיאור כללי:**
Chat interface לשיחה עם AI על ניתוח משחקים עם streaming responses ו-thinking indicators.

**תלויות:**
- **ייבוא:** `getGames`, `askAdvisorStream`, `framer-motion`, `AnimatePresence`

**State:**
```javascript
selectedGame: Game | null
messages: ChatMessage[]
thinkingStep: string   // "מתכנן...", "מנתח...", "מסכם..."
remaining: number | null  // הודעות שנשארו מ-20
```

### `sendMessage(text)`
1. מוסיף user message למערך
2. יוצר placeholder assistant message
3. קורא `askAdvisorStream` עם callback:
   - `thinking` → מעדכן `thinkingStep`
   - `tool_call` → מציג שם הכלי (get_team_form וכו')
   - `token` → מצרף ל-reply הנוכחי (streaming)
   - `done` → מנקה thinkingStep, מורד remaining
   - `error` → מציג הודעת שגיאה

**Suggested Questions:** מוצגות רק לפני ההודעה הראשונה.

**הסבר לא ברור:** `messages.filter(m => m.id !== "welcome")` – הודעת הברכה לא נשלחת לAPI.

---

## MiniGamesHubPage.tsx – מרכז מיני-גיימס

**תיאור כללי:**
Hub עם 5 חידות יומיות וסטטוס פתרון לכל אחת.

**תלויות:**
- **ייבוא:** `fetch` ישיר ל-`/api/minigames/today` + `/api/minigames/status`
- **ממצא:** MiniGamePlayPage

**Data Fetching (useEffect):**
1. fetch `/api/minigames/today` → setPuzzles
2. אם logged in: fetch status בפניה נפרדת עם Bearer token

**Status Display:**
- ✅ completed → disabled, green
- ⚠️ 3 attempts used → disabled, red
- 🎮 available → button "שחקו"

---

## MiniGamePlayPage.tsx – משחק מיני יחיד

**תיאור כללי:**
Routing לקומפוננטת המשחק הנכון, submit guess, ResultModal.

**תלויות:**
- **ייבוא:** GuessClubGame, WhoAreYaGame, CareerPathGame, Box2BoxGame, MissingXIGame, TriviaGame, ResultModal

**useEffect #1:** Fetch puzzle מ-today list לפי params.id
**useEffect #2:** Fetch attempt status → אם כבר פתור/3 attempts, navigate('/minigames')

### `handleSolve(guess)`
POST ל-`/api/minigames/submit` → parse תוצאה (is_correct, points_added, show_answer, attempt_count) → setModalState.

### `renderGame()`
```javascript
switch(puzzle.game_type) {
  case 'guess_club': return <GuessClubGame .../>
  case 'who_are_ya': return <WhoAreYaGame .../>
  // ...
}
```
**הסבר:** `key={${id}-${attemptCount}}` מאפס את state הקומפוננטה בכל ניסיון חדש.

**Points per Attempt:**
| ניסיון | נקודות |
|--------|--------|
| 1      | 500    |
| 2      | 300    |
| 3      | 100    |

---

## AdminDashboard.tsx – לוח ניהול

**תיאור כללי:**
11 טאבים לניהול מלא: סקירה, משתמשים, הימורים, משחקים, ליגות, התראות, תמיכה, מיני-גיימס, מתקדם, יועץ AI, סוכנים חברתיים.

**תלויות:**
- **ייבוא:** 30+ API functions, `AdvisorTab`, `SocialAgentTab`, Recharts

**ADMIN_EMAILS (hardcoded):**
```javascript
["nir.dahan2001@gmail.com", "dordavidm8@gmail.com", "kickoffsportsapp@gmail.com"]
```
**הסבר:** רשימה זו משמשת גם בbottomtabbar לנעילת "Expert" tab.

**Tabs Summary:**

| Tab | מטרה |
|-----|-------|
| Stats | KPIs: משתמשים, הימורים, ליגות, transactions |
| Users | רשימה, עריכה, מחיקה, התאמת נקודות |
| Bets | צפייה בהימורים לפי סטטוס |
| Games | featured, lock, odds override, translation approval |
| Leagues | ניהול ליגות, WA groups, סגירת עונה |
| Notifications | שליחה לכולם / משתמש / ליגה |
| Support | פנייות תמיכה + מענה |
| MiniGames | תור חידות, preview, עריכה, אישור |
| Advanced | תרגומי קבוצות, settlement ידני |
| Advisor | ← AdvisorTab component |
| Social | ← SocialAgentTab component |

---

## ProfilePage.tsx – פרופיל אישי

**תיאור כללי:**
עריכת שם משתמש/שם מלא/סיסמה, upload תמונה, WhatsApp OTP flow, קוד הפניה, פניות תמיכה.

**תלויות:**
- **ייבוא:** `useAuth`, Firebase auth functions, `AvatarUploader`, WA API functions, `getMyAchievements`, `getDetailedStats`

**WhatsApp OTP Flow:**
```
idle → [הזן טלפון + לחץ "חבר"] → awaiting_code → [הזן קוד] → verified
```
- Timer: 300 שניות עד לאפשרות Resend
- נרמול טלפון: "0551234567" → "+972551234567"

**Password Change:**
- reauthenticate (Email + current password)
- updatePassword (Firebase)

**Referral:** קוד = user ID, link לשיתוף WhatsApp.

**Dangerous Zone:** "מחק חשבון" עם confirm dialog.

---

## PublicProfilePage.tsx – פרופיל ציבורי

**תיאור כללי:**
פרופיל של משתמש אחר: סטטיסטיקות, הישגים, הימורים אחרונים, follow/unfollow.

**תלויות:**
- **ייבוא:** `getPublicProfile`, `followUser`, `unfollowUser`

**Follow Toggle:**
```javascript
useMutation: isFollowing ? unfollowUser : followUser
onSuccess: invalidateQueries(["public-profile", username])
```

---

## QuizPage.tsx – חידון טריוויה

**תיאור כללי:**
שאלת טריוויה אחת בכל פעם, multiple choice, פידבק מיידי + session score + streak.

**תלויות:**
- **ייבוא:** `getNextQuestion`, `answerQuestion`, `framer-motion`, `AnimatePresence`

**answerMutation:**
```javascript
onSuccess: (res) => {
  if (res.correct) { sessionScore++; streak++; }
  else streak = 0;
  queryClient.invalidateQueries(["my-stats"]);
}
```

**Option Styling:** Green=correct, Red=selected-wrong, Gray=unselected (מוצג אחרי תשובה).

---

## StatsPage.tsx – סטטיסטיקות מפורטות

**תיאור כללי:**
סטטיסטיקות מקיפות: win rate, ROI, breakdown לפי תחרות, טרנדים חודשיים.

**תלויות:**
- **ייבוא:** `getDetailedStats`, `framer-motion`

**StatCard Component:**
```javascript
<StatCard label="win rate" value="60%" highlight={true} />
// highlight = primary color + border
```

**Sections:**
- Main Stats Grid (8 מדדים)
- By Competition (win rate bar charts)
- Monthly Breakdown (נטו רווח/הפסד לכל חודש)

---

## LoginPage.tsx – כניסה והרשמה

**תיאור כללי:**
דף יחיד עם 3 modes: login, register, forgot password.

**תלויות:**
- **ייבוא:** `useAuth` (signIn, signUp, signInWithGoogle, sendPasswordReset, continueAsGuest)

**Modes:**
- **login:** email + password + Google + "שכחתי" link
- **register:** display_name, username, email, password, referral code, age checkbox
- **forgot:** email → send reset link

### `friendlyError(err): string`
מתרגם Firebase error codes לעברית:
- `auth/invalid-credential` → "שם המשתמש או סיסמה שגויים"
- `auth/email-already-in-use` → "אימייל כבר בשימוש"
- `auth/weak-password` → "סיסמה חייבת להיות לפחות 6 תווים"

---

## OnboardingPage.tsx – הדרכה למשתמשים חדשים

**תיאור כללי:**
3 slides אינטראקטיביים המסבירים את המשחק.

**Slides:**
1. ברוכים הבאים (5000 נקודות)
2. איך להמר (בחר, ענה, זמן)
3. ליגות פרטיות (WhatsApp, 1000 נקודות הפניה)

**state:** `step: 0-2`, לחצן "הבא" → last slide שומר `localStorage.onboarding_done` + navigate.

---

## AllGamesPage.tsx – כל המשחקים

**תיאור כללי:**
רשימת כל משחקי scheduled עם חיפוש, פילטור תחרות ותאריכים.

**תלויות:**
- **ייבוא:** `getGames`, `GameListItem`

**useQuery:** `queryKey: ["all-games", league, search, from, to]` – דינמי לפי פילטרים.

**Filters:** league select, search input, date range (from/to).

---

## FinishedGamesPage.tsx – תוצאות משחקים

**תיאור כללי:**
תוצאות 30 ימים אחרונים עם toggle "הכל / ההימורים שלי".

**תלויות:**
- **ייבוא:** `getFinishedGames`, `getMyBets`, `translateTeam`, `translateOutcomeLabel`

**Toggle:** שינוי `showMyBets` → מציג הימורי המשתמש ליד כל משחק.

---

## HelpPage.tsx – עזרה ותמיכה

**תיאור כללי:**
דף FAQ ו-credits.

**Sections:** איך מתחילים, WhatsApp, ליגות, נקודות, הפניות, credits/LinkedIn.

**CTA:** "בואו נהמר!" → navigate('/').

---

## NotFound.tsx – דף 404

**תיאור כללי:** דף 404 פשוט עם logging ל-console וכפתור חזרה לבית.

```javascript
useEffect(() => {
  console.error("404 Error:", location.pathname);
}, [location.pathname]);
```
