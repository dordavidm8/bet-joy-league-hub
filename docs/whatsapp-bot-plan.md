# תוכנית מימוש: WhatsApp Bot לקיקאוף

> **סטטוס:** Backend + Frontend + כל קוד הבוט מומשו במלואם — ממתין לחיבור SIM וסריקת QR  
> **תאריך עדכון:** אפריל 2026  
> **ספרייה לבוט:** `whatsapp-web.js` (Puppeteer) — אותה ספרייה שGroupShield בנוי עליה, מוכחת ב-production

---

## סטטוס נוכחי — מה מומש ומה נותר

### ✅ מומש במלואו

#### Backend (`backend/src/routes/whatsapp.js`)
כל ה-API routes קיימים ועובדים:
- `POST /api/whatsapp/link-phone` — שליחת OTP
- `POST /api/whatsapp/verify` — אימות OTP
- `DELETE /api/whatsapp/unlink` — ניתוק מספר
- `GET /api/whatsapp/status` — סטטוס קישור
- `PATCH /api/whatsapp/opt-in` — הגדרות הודעות
- `POST /api/whatsapp/leagues/:id/create-group` — יצירת קבוצה
- `POST /api/whatsapp/leagues/:id/link-group` — קישור קבוצה קיימת
- `POST /api/whatsapp/leagues/:id/refresh-invite-link` — קבלת invite link מהבוט
- `PUT /api/whatsapp/leagues/:id/invite-link` — הגדרת invite link ידנית
- `DELETE /api/whatsapp/leagues/:id/group` — ניתוק קבוצה
- `GET/PUT /api/whatsapp/leagues/:id/settings` — הגדרות WA לליגה

#### Backend Service (`backend/src/services/whatsappBotService.js`)
- `sendDM(phone, text)` — שולח הודעה דרך הבוט (STUB_MODE בסביבת dev)
- `callBot(endpoint, body)` — קריאות internal API לבוט

#### DB — כל הטבלאות קיימות ב-production
- `wa_verification_codes` — OTP codes
- `wa_sessions` — שיחות פעילות (state machine)
- `wa_groups` — קבוצות מקושרות לליגות
- `wa_league_settings` — הגדרות WA לכל ליגה
- `users.phone_number`, `users.phone_verified`, `users.wa_opt_in` — שדות משתמש
- `leagues.wa_enabled` — האם הליגה מחוברת ל-WA
- `bets.wa_bet`, `bets.wa_source`, `bets.wa_bet_message_id` — שדות הימור WA

#### Frontend
- **ProfilePage** — סקשן "חיבור לווטסאפ" משולב תחת "הגדרות": OTP flow, opt-in toggle, unlink
- **LeagueDetailPage** — סקשן WA לניהול קבוצה: create/link/unlink, invite link עם כפתור רענון ועדכון ידני

#### ENV Variables (Railway)
```
WHATSAPP_BOT_URL=http://localhost:4001   # כתובת internal API של הבוט
STUB_MODE=false                          # true בפיתוח — מחזיר OTP ב-response
INTERNAL_API_KEY=<secret>               # אימות קריאות internal
```

---

### ✅ קוד הבוט — מומש במלואו (whatsapp-bot/)

כל הקוד נכתב ומוכן. **ממתין לחיבור SIM וסריקת QR בלבד.**

### ⏳ נותר — חיבור SIM וDeploy  
1. חבר SIM לטלפון/מכשיר
2. הרץ `node bot.js` — סרוק QR
3. הגדר Railway service חדש (root: `whatsapp-bot/`)
4. הוסף Volume לsession + ENV variables
5. הגדר `BOT_INTERNAL_URL` בbackend service

#### מה צריך לבנות (לפי סדר עדיפות):

**שלב A — הבוט עולה (הכי קריטי)**
- [ ] `whatsapp-bot/bot.js` — entry point עם Baileys (ולא whatsapp-web.js כפי שתוכנן)
- [ ] Session persistence — שמירת credentials בקובץ / Railway Volume
- [ ] `whatsapp-bot/src/internalApi.js` — HTTP server על port 4001:
  - `POST /internal/send` — DM לטלפון
  - `POST /internal/send-group` — הודעה לקבוצה
  - `POST /internal/create-group` — יצירת קבוצה חדשה
  - `POST /internal/get-invite-link` — קבלת invite link לקבוצה קיימת
  - `POST /internal/add-member` — הוספת חבר לקבוצה
  - `POST /internal/react` — React על הודעה

**שלב B — הודעות בוקר + הימור**
- [ ] `scheduledJobs.js` — cron לשליחת הודעות בוקר לכל ליגה בשעה המוגדרת
- [ ] `morningMessages.js` — בניית טקסט הודעה + שמירת wa_message_id ב-`wa_game_messages`
- [ ] `groupHandler.js` — reply detection: זיהוי שהתגובה היא לאחת מהודעות המשחק
- [ ] `betCommands.js` — `processBetReply()`: פרסינג (1/X/2 + תוצאה מדויקת), יצירת הימור ב-DB, react 👍

**שלב C — תזכורות + תוצאות**
- [ ] `reminderNotifier.js` — @mentions לפני נעילה
- [ ] `resultNotifier.js` — הודעת תוצאה + ניקוד אחרי `settleBets.js`
- [ ] `leaderboardNotifier.js` — טבלה תקופתית

**שלב D — DM State Machine**
- [ ] `dmHandler.js` + `stateRouter.js` — פקודות כמו `/balance`, `/games`, `/mybets`

---

### ⚠️ הערות לממש הבא

1. **whatsapp-web.js (Puppeteer)** — `whatsappBotService.js` קורא ל-`WHATSAPP_BOT_URL`, הבוט חושף REST API, ובפנים משתמשים ב-whatsapp-web.js כמו GroupShield. `LocalAuth` שומר session בקבצים — לא צריך QR אחרי login ראשוני.

2. **`wa_game_messages` טבלה** — צריך לוודא שהיא קיימת ב-DB (לא נוצרה עדיין, כי הבוט לא פועל). הוסף migration לפני שלב B.

3. **`wa_reminders_sent` טבלה** — גם היא צריכה migration לפני שלב C.

4. **Railway Deployment** — הבוט אמור לרוץ כ-process נפרד באותו service ב-Railway (PM2 / Procfile). ראה סעיף 18.

5. **`BOT_PHONE` ENV** — חשוב להגדיר אחרי חיבור ה-SIM: המספר שהבוט מחובר אליו (לlinks בהודעות).

---

---

## תוכן עניינים

1. [סקירה כללית](#1-סקירה-כללית)
2. [בסיס טכנולוגי: whatsapp-web.js](#2-בסיס-טכנולוגי)
3. [הגדרות ליגת WhatsApp](#3-הגדרות-ליגת-whatsapp)
4. [חיבור הבוט: קבוצה חדשה או קיימת](#4-חיבור-הבוט-קבוצה-חדשה-או-קיימת)
5. [קישור מספר טלפון לחשבון](#5-קישור-מספר-טלפון-לחשבון)
6. [הודעות בוקר ומנגנון ההימור](#6-הודעות-בוקר-ומנגנון-ההימור)
7. [מצבי הימור](#7-מצבי-הימור)
8. [תיקון הימור](#8-תיקון-הימור)
9. [הימור פרטי ב-DM](#9-הימור-פרטי-ב-dm)
10. [תזכורת לפני סגירת הימור](#10-תזכורת-לפני-סגירת-הימור)
11. [עדכון תוצאות ונקודות אחרי משחק](#11-עדכון-תוצאות-ונקודות-אחרי-משחק)
12. [שליחת טבלה תקופתית](#12-שליחת-טבלה-תקופתית)
13. [סיום ליגה/טורניר](#13-סיום-ליגהטורניר)
14. [סנכרון WhatsApp ↔ אתר](#14-סנכרון-whatsapp--אתר)
15. [State Machine — DM פרטי](#15-state-machine--dm-פרטי)
16. [סכמת DB](#16-סכמת-db)
17. [API Routes](#17-api-routes)
18. [תשתית ו-Deployment](#18-תשתית-ו-deployment)
19. [מפת קבצים](#19-מפת-קבצים)
20. [סדר מימוש](#20-סדר-מימוש)

---

## 1. סקירה כללית

### מה נבנה

| פיצ'ר | תיאור |
|--|--|
| **מספר בוט** | מספר WhatsApp ייעודי |
| **קישור משתמש** | חשבון קיקאוף ↔ מספר טלפון (OTP) |
| **הודעות בוקר** | הבוט שולח הודעה לכל משחק מחר, reply להמרה |
| **תגובת 👍** | הבוט מאשר הימור ב-react או מסרב בהודעת שגיאה |
| **תיקון הימור** | reply לקודם = עדכון |
| **תזכורת** | @mention לכל מי שלא הימר לפני נעילה |
| **עדכון תוצאות** | הבוט מפרסם בקבוצה אחרי כל משחק |
| **טבלה תקופתית** | בתדירות שמנהל הליגה הגדיר |
| **DM פרטי** | אותן הודעות + reply-based betting גם ב-DM |
| **סנכרון** | כל הימור מWhatsApp מופיע באתר ולהפך |

### עקרונות
- כל הודעות הבוט בעברית
- יתרה ונתונים אישיים — רק ב-DM, לא בקבוצה
- כל פעולה פיננסית (הימור) דורשת חשבון מקושר
- Rate limit: 10 פקודות/דקה לJID

---

## 2. בסיס טכנולוגי

### whatsapp-web.js (Puppeteer)
- **כבר מוכחת**: GroupShield בנוי עליה ורץ ב-production
- **קבוצות אמיתיות**: יצירה, הוספת משתתפים, קבלת אירועים
- **LocalAuth**: session נשמרת בקבצים — לא צריך QR אחרי login ראשוני
- **Reply detection**: `msg.hasQuotedMsg` + `msg.getQuotedMessage()` — בדיוק מה שצריך לשיטת ה-reply

### Process נפרד
```
Railway
├── Express Backend (port 4000)   ← קיים
└── WhatsApp Bot Process          ← חדש
    ├── whatsapp-bot/bot.js
    └── PM2 (ecosystem.config.js)
```
שני ה-processes חולקים PostgreSQL אחת. הבוט חושף internal REST API על port 4001.

---

## 3. הגדרות ליגת WhatsApp

### שדות חדשים בטופס יצירת ליגה

כאשר מפעילים "WhatsApp Bot לליגה", מוצגות ההגדרות הבאות:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 הגדרות WhatsApp Bot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
חיבור קבוצה:
  ○ צור קבוצת WhatsApp חדשה
  ○ הוסף בוט לקבוצה קיימת (הסבר: הוסף את [מספר הבוט] לקבוצה קיימת)

מצב הימור:
  ○ סכום התחלתי — כל הימור על נקודה וירטואלית, ניצחת = קיבלת, הפסדת = לא קיבלת כלום
  ○ סכום קבוע לכל הימור — [שדה: כמה נקודות] נקודות מהיתרה

הימור על תוצאה מדויקת:
  ○ ✅ אפשר להמר על תוצאה מדויקת (x3 מיחס הניצחון)

הודעת בוקר:
  [שעה] — בכל יום HH:MM לשלוח הודעות על משחקי המחר

תזכורת לפני נעילה:
  [X] שעות לפני תחילת המשחק

שליחת טבלה:
  ○ לא לשלוח
  ○ אחרי כל משחק
  ○ פעם ביום [HH:MM]
  ○ פעם בשבוע [יום] [HH:MM]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### שמירה ב-DB
כל הגדרות אלו נשמרות ב-`wa_league_settings` (ראה [סכמת DB](#16-סכמת-db)).

---

## 4. חיבור הבוט: קבוצה חדשה או קיימת

### אפשרות א': יצירת קבוצה חדשה

```
[App] → POST /api/whatsapp/leagues/:id/create-group
    ↓
[Bot Internal API]
client.createGroup(leagueName, [creatorPhone])
    ↓
מוחזר: wa_group_id, invite_link
    ↓
[DB] שמירת wa_groups record
    ↓
[App] Banner: "קבוצה נוצרה! 📱 קישור: wa.me/..."
```

### אפשרות ב': הוספת בוט לקבוצה קיימת

1. **מנהל הליגה** מוסיף את מספר הבוט לקבוצת WhatsApp הקיימת
2. **בקבוצה**, מנהל הליגה שולח: `/kickoff setup <invite_code_של_הליגה>`
3. **הבוט** מקבל את ההודעה, מאמת את ה-invite code, ומקשר את הקבוצה לליגה
4. **הבוט** בודק אילו חברי הקבוצה מקושרים לקיקאוף (לפי phone number):
   ```
   בוט: ✅ ליגת "חברים של אבי" מחוברת!
   חברים מזוהים: ישראל, שרה, דוד (3/5)
   חברים לא מזוהים: 2 מספרים לא מקושרים לקיקאוף.
   שלחו להם: [קישור לקיקאוף] להתחבר ולקשר את המספר.
   ```
5. **חברי קבוצה ללא חשבון קיקאוף** — הבוט מתעלם מהם לחלוטין

### זיהוי הקבוצה בבוט

```javascript
// כל הודעה מקבוצה:
const waGroup = await pool.query(
    'SELECT * FROM wa_groups WHERE wa_group_id=$1 AND is_active=true', [groupJid]
);
if (!waGroup.rows[0]) return; // לא קבוצת קיקאוף — התעלם
```

---

## 5. קישור מספר טלפון לחשבון

### זרימה (ProfilePage)

```
[App] משתמש מזין מספר → POST /api/whatsapp/link-phone
    ↓
[Backend] מייצר OTP 6 ספרות (TTL 10 דקות)
    ↓ POST /internal/send (לבוט)
[Bot → DM למספר]
"👋 קוד האימות לקיקאוף: 472918
קוד זה תקף ל-10 דקות."
    ↓
[App] משתמש מזין קוד → POST /api/whatsapp/verify
    ↓
[Backend] מאמת, מסמן phone_verified=true
```

### תקשורת Backend ↔ Bot

הבוט מריץ internal REST server על port 4001:

```javascript
// whatsapp-bot/src/internalApi.js
POST /internal/send          → { phone, text }
POST /internal/send-group    → { groupJid, text }
POST /internal/create-group  → { name, phones[] }
POST /internal/add-member    → { groupJid, phone }
POST /internal/react          → { msgId, groupJid, emoji }
```

כל הקריאות מאומתות עם `INTERNAL_API_KEY` בheader.

---

## 6. הודעות בוקר ומנגנון ההימור

### 6.1 — שליחת הודעות בוקר

**Cron job בבוט** רץ בכל דקה ובודק אם הגיע זמן השליחה לכל ליגה:

```javascript
// בכל דקה
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const leagues = await pool.query(`
        SELECT wls.*, w.wa_group_id, l.name as league_name
        FROM wa_league_settings wls
        JOIN wa_groups w ON w.league_id = wls.league_id
        JOIN leagues l ON l.id = wls.league_id
        WHERE wls.morning_message_time = $1  -- HH:MM של עכשיו
    `, [formatHHMM(now)]);

    for (const league of leagues.rows) {
        await sendMorningMessages(client, league);
    }
});
```

**`sendMorningMessages`** — שולח הודעה לכל משחק של מחר שרלוונטי לליגה:

```javascript
async function sendMorningMessages(client, league) {
    const tomorrow = getTomorrow();
    const games = await getLeagueGamesForDate(league.league_id, tomorrow);

    for (const game of games) {
        const text = buildGameMessage(game, league);

        // שליחה לקבוצה
        const groupMsg = await client.sendMessage(league.wa_group_id, text);
        
        // שמירת message ID לזיהוי replies
        await pool.query(`
            INSERT INTO wa_game_messages (league_id, game_id, group_jid, wa_message_id, sent_at)
            VALUES ($1,$2,$3,$4,NOW())
        `, [league.league_id, game.id, league.wa_group_id, groupMsg.id._serialized]);

        // שליחה ב-DM לכל חבר מקושר
        await sendGameMessageToDMs(client, league, game, text);
    }
}
```

### 6.2 — פורמט הודעת משחק

```
⚽ ריאל מדריד נגד ברצלונה
🗓 מחר | 21:45

הגב להודעה זו עם ההימור שלך:
• 1 — ניצחון ריאל מדריד
• X — תיקו
• 2 — ניצחון ברצלונה

[אם exact_score_enabled]:
להימור על תוצאה מדויקת, הוסף שורה שנייה:
  1
  2-0
(מכפיל x3 על יחס הניצחון)
```

### 6.3 — קבלת הימור: Reply Handler

```javascript
// handlers/groupHandler.js — בכל הודעה לקבוצה
async function handleGroupMessage(client, msg, senderJid, groupJid, content) {
    // בדיקה: האם זו reply?
    if (!msg.hasQuotedMsg) return;

    const quoted = await msg.getQuotedMessage();
    const quotedId = quoted.id._serialized;

    // בדיקה: האם ה-reply הוא לאחת מהודעות המשחקים?
    const gameMsg = await pool.query(
        'SELECT * FROM wa_game_messages WHERE wa_message_id=$1', [quotedId]
    );
    if (!gameMsg.rows[0]) return; // reply על הודעה אחרת — התעלם

    const record = gameMsg.rows[0];
    const user = await getUserByPhone(extractNumber(senderJid));
    
    if (!user) {
        // משתמש לא מקושר — לא מגיבים בקבוצה (רק אם הגיב ב-DM)
        return;
    }

    await processBetReply(client, msg, senderJid, user, record, content, 'group');
}
```

### 6.4 — פרסינג ואימות ההימור

```javascript
async function processBetReply(client, msg, senderJid, user, gameMsg, content, source) {
    const lines = content.trim().split('\n').map(l => l.trim());
    const resultLine = lines[0].toUpperCase(); // "1", "X", "2"
    const scoreLine  = lines[1] || null;       // "2-0" (אופציונלי)

    // ולידציה שורה 1
    if (!['1','X','2'].includes(resultLine)) {
        await msg.reply('❌ פורמט לא תקין. שלח 1, X, או 2 (ובשורה שנייה תוצאה מדויקת כמו 2-0)');
        return;
    }

    // ולידציה שורה 2 (אם נשלחה)
    if (scoreLine && !/^\d+-\d+$/.test(scoreLine)) {
        await msg.reply('❌ פורמט תוצאה מדויקת לא תקין. דוגמה: 2-0');
        return;
    }

    // בדיקה: האם כבר הימר על משחק זה?
    const existing = await pool.query(
        'SELECT id FROM bets WHERE user_id=$1 AND game_id=$2 AND wa_bet=true',
        [user.id, gameMsg.game_id]
    );

    if (existing.rows[0]) {
        // עדכון הימור קיים (תיקון)
        await updateExistingBet(existing.rows[0].id, resultLine, scoreLine, gameMsg, user);
    } else {
        // הימור חדש
        await createNewBet(resultLine, scoreLine, gameMsg, user, source);
    }

    // React 👍 להודעה
    await msg.react('👍');
    
    // לוג
    await logWaMessage('in', extractNumber(senderJid), null, content, null, null, 'bet_placed');
}
```

---

## 7. מצבי הימור

### 7.1 — מצב "סכום התחלתי" (Prediction Mode)

- כל הימור עולה **0 נקודות** מהיתרה האמיתית
- ניצחת → הרווחת `round(1 × odds)` נקודות לחשבון הליגה בלבד (`points_in_league`)
- הפסדת → לא קיבלת כלום, לא הפסדת כלום
- ב-DB: `bets.stake = 0`, `bets.is_free_bet = true`
- `potential_payout = round(1 × odds)` (round(1 × outcome_odds))
- ההימור לא מנכה מ-`users.points_balance`

```javascript
// יצירת הימור במצב prediction
await pool.query(`
    INSERT INTO bets (user_id, game_id, bet_question_id, selected_outcome,
                      stake, odds, potential_payout, is_free_bet, wa_bet, wa_source)
    VALUES ($1,$2,$3,$4, 0, $5, round(1*$5), true, true, $6)
`, [userId, gameId, questionId, outcome, odds, source]);
// *** לא מנכים מ-points_balance ***
```

### 7.2 — מצב "סכום קבוע" (Fixed Stake Mode)

- כל הימור מנכה `league_settings.stake_amount` נקודות מ-`points_balance`
- ניצחת → הרווחת `round(stake × odds)` נקודות
- הפסדת → הפסדת את ה-stake
- זהה להגיון ההימור הרגיל, רק שה-stake קבוע ומוגדר מראש

```javascript
// יצירת הימור במצב fixed
const stake = leagueSettings.stake_amount;
// ניכוי מהיתרה (כמו bets.js קיים):
await pool.query(
    'UPDATE users SET points_balance = points_balance - $1 WHERE id=$2 AND points_balance>=$1',
    [stake, userId]
);
await pool.query(`
    INSERT INTO bets (..., stake, potential_payout, is_free_bet, wa_bet)
    VALUES (..., $1, round($1*$2), false, true)
`, [stake, odds]);
```

### 7.3 — הימור על תוצאה מדויקת

- זמין רק כשהליגה מוגדרת עם `exact_score_enabled = true`
- שורה 1: `1/X/2` (חובה)
- שורה 2: `[גולים]-[גולים]` (אופציונלי)
- **יחס:** `exact_score_odds = winner_odds × 3`
- בDD: שני records נוצרים:
  - bet 1: על הזוכה (1/X/2) — odds רגיל
  - bet 2: על התוצאה המדויקת — odds × 3

```javascript
// אם נשלחה תוצאה מדויקת:
if (scoreLine && leagueSettings.exact_score_enabled) {
    const exactOdds = winnerOdds * 3;
    await createBet(userId, gameId, exactScoreQuestionId, scoreLine, exactOdds, ...);
}
```

> **הערה:** שאלת "תוצאה מדויקת" (`bet_question` מסוג `exact_score`) תיווצר אוטומטית לכל משחק שנשלחת עליו הודעת בוקר בליגת WhatsApp שמפעילה exact_score.

### 7.4 — סוגי הימור מותרים ב-WhatsApp

| סוג הימור | קבוצה | DM פרטי | אתר |
|--|--|--|--|
| זהות הזוכה (1/X/2) | ✅ | ✅ | ✅ |
| תוצאה מדויקת | ✅ (שורה 2) | ✅ (שורה 2) | ✅ |
| שני הקבוצות יבקיעו | ❌ | ✅ (פקודה) | ✅ |
| Over/Under | ❌ | ✅ (פקודה) | ✅ |

---

## 8. תיקון הימור

### זרימה

```
ישראל שלח קודם: "1"  → בוט עשה 👍 (הימור נשמר: ניצחון ריאל מדריד)

אחר כך ישראל שולח reply להודעה שלו: "2"

בוט:
  1. מוצא שה-reply הוא להודעה של ישראל עצמו (msgFromMe or user check)
  2. מבין שזהו תיקון הימור
  3. מוצא את ההימור הקיים (bet שנוצר מאותו wa_message_id)
  4. מוחק/מבטל את ההימור הישן ויוצר חדש
     (במצב fixed: מחזיר את ה-stake הישן, מנכה חדש)
     (במצב prediction: פשוט מעדכן outcome)
  5. 👍 על ההודעה החדשה
```

**ב-DB:**
- הבוט שומר גם `wa_bet_message_id` על כל bet — ה-message ID של הודעת המשתמש (לא הודעת הבוט)
- כשמגיע reply: בדיקה אם ה-quoted message הוא הימור קיים של אותו משתמש

```javascript
// תיקון הימור — הbוט מזהה שה-quoted היא הודעת הימור של המשתמש
const prevBet = await pool.query(
    'SELECT * FROM bets WHERE wa_bet_message_id=$1 AND user_id=$2',
    [quotedMsg.id._serialized, user.id]
);

if (prevBet.rows[0]) {
    // זה תיקון הימור
    if (!prevBet.rows[0].is_free_bet) {
        // החזר stake ישן
        await pool.query('UPDATE users SET points_balance=points_balance+$1 WHERE id=$2',
            [prevBet.rows[0].stake, user.id]);
    }
    // בטל הימור ישן
    await pool.query("UPDATE bets SET status='cancelled' WHERE id=$1", [prevBet.rows[0].id]);
    // צור הימור חדש
    await createNewBet(...);
    await msg.react('👍');
}
```

---

## 9. הימור פרטי ב-DM

### מה קורה

כשהבוט שולח הודעות בוקר לקבוצה, הוא **גם שולח** את אותה הודעה ב-DM לכל חבר ליגה מקושר:

```javascript
async function sendGameMessageToDMs(client, league, game, text) {
    const members = await pool.query(`
        SELECT u.phone_number 
        FROM league_members lm
        JOIN users u ON u.id = lm.user_id
        WHERE lm.league_id=$1 AND u.phone_verified=true AND u.wa_opt_in=true
    `, [league.league_id]);

    for (const member of members.rows) {
        const dmMsg = await client.sendMessage(`${member.phone_number}@c.us`, text);
        
        // שמירה נפרדת ב-wa_game_messages עבור ה-DM
        await pool.query(`
            INSERT INTO wa_game_messages (league_id, game_id, dm_phone, wa_message_id, sent_at)
            VALUES ($1,$2,$3,$4,NOW())
        `, [league.league_id, game.id, member.phone_number, dmMsg.id._serialized]);
    }
}
```

### Reply ב-DM

הלוגיקה זהה לגמרי לקבוצה:
1. המשתמש מגיב ב-DM להודעת המשחק
2. הבוט מוצא את ה-`wa_game_messages` record לפי `wa_message_id`
3. יוצר הימור עם `wa_source = 'dm'`
4. React 👍 ב-DM
5. ההימור מסונכרן עם הקבוצה והאתר

> ה-DM מאפשר להמר גם בהימורים נוספים (both_teams_score, over_under) — ראה [סעיף 7.4](#74--סוגי-הימור-מותרים-ב-whatsapp)

---

## 10. תזכורת לפני סגירת הימור

### הגדרה

מנהל הליגה מגדיר: "שלח תזכורת X שעות לפני תחילת המשחק".  
שמור ב-`wa_league_settings.reminder_hours_before`.

### Cron Job

```javascript
// כל 5 דקות: בדיקת משחקים שמתחילים בעוד reminder_hours_before שעות
cron.schedule('*/5 * * * *', async () => {
    const leagues = await pool.query(`
        SELECT wls.*, wg.wa_group_id, wl.league_id as lid
        FROM wa_league_settings wls
        JOIN wa_groups wg ON wg.league_id = wls.league_id
        WHERE wls.reminder_hours_before IS NOT NULL
    `);

    for (const league of leagues.rows) {
        const targetTime = addHours(new Date(), league.reminder_hours_before);
        const games = await getGamesStartingAround(targetTime, 5); // ±5 דקות

        for (const game of games) {
            // בדיקה: כבר נשלחה תזכורת למשחק הזה?
            const sent = await pool.query(
                'SELECT 1 FROM wa_reminders_sent WHERE league_id=$1 AND game_id=$2',
                [league.lid, game.id]
            );
            if (sent.rows[0]) continue;

            // מי לא הימר עדיין?
            const nonBettors = await getNonBettors(league.lid, game.id);
            if (nonBettors.length === 0) continue;

            const mentions = nonBettors.map(u => `@${u.phone_number}`).join(' ');
            const text = `⏰ תזכורת! ההימור על ${game.home_team} נגד ${game.away_team} נסגר בעוד ${league.reminder_hours_before} שעות.\n${mentions} — עוד לא הימרתם!`;
            
            await client.sendMessage(league.wa_group_id, text);
            
            // סימון שנשלחה
            await pool.query(
                'INSERT INTO wa_reminders_sent (league_id, game_id) VALUES ($1,$2)',
                [league.lid, game.id]
            );
        }
    }
});
```

---

## 11. עדכון תוצאות ונקודות אחרי משחק

### טריגר

לאחר ש-`settleBets.js` מסיים את עיבוד המשחק, הוא קורא:
```javascript
// backend/src/jobs/settleBets.js — אחרי settleGame()
await whatsappBotService.notifyGameResult(gameId);
```

### הבוט מפרסם בכל ליגה רלוונטית

```javascript
async function notifyGameResult(gameId) {
    // מוצא את כל ליגות הWhatsApp שהמשחק רלוונטי אליהן
    const leagues = await pool.query(`
        SELECT wg.wa_group_id, wgm.league_id
        FROM wa_game_messages wgm
        JOIN wa_groups wg ON wg.league_id = wgm.league_id
        WHERE wgm.game_id=$1 AND wgm.group_jid IS NOT NULL
        GROUP BY wg.wa_group_id, wgm.league_id
    `, [gameId]);

    for (const league of leagues.rows) {
        const result = await buildGameResultMessage(gameId, league.league_id);
        await client.sendMessage(league.wa_group_id, result);
    }
}
```

### פורמט הודעת תוצאה

```
━━━━━━━━━━━━━━━━━━━━━━
📊 ריאל מדריד 2-1 ברצלונה

🏆 מנצחים:
🥇 ישראל — +360 נקודות (x1.80)
🥈 שרה — +210 נקודות (x2.10 תוצאה מדויקת!)

😔 לא הצלחנו: דוד, רונן
🚫 לא הימרו: מיכל

📊 דירוג ליגה:
1. ישראל — 2,450 ⭐
2. שרה — 2,100
3. דוד — 1,800
━━━━━━━━━━━━━━━━━━━━━━
```

> הטבלה מופיעה בהודעת התוצאה רק אם הוגדר `leaderboard_frequency = 'after_game'`.

---

## 12. שליחת טבלה תקופתית

### הגדרות האפשריות

| הגדרה | תיאור |
|--|--|
| `never` | לא שולח טבלה (מוצגת רק בסיום משחק אם הוגדר) |
| `after_game` | שולח טבלה אחרי כל סיום משחק |
| `daily` | שולח טבלה בשעה קבועה כל יום |
| `weekly` | שולח טבלה פעם בשבוע, ביום ובשעה שנקבעו |

### Cron לטבלה יומית/שבועית

```javascript
// בכל דקה: בדיקת ליגות שצריכות לשלוח טבלה
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const leagues = await pool.query(`
        SELECT wls.*, wg.wa_group_id
        FROM wa_league_settings wls
        JOIN wa_groups wg ON wg.league_id = wls.league_id
        WHERE 
            (wls.leaderboard_frequency = 'daily' AND wls.leaderboard_time = $1)
            OR
            (wls.leaderboard_frequency = 'weekly'
                AND wls.leaderboard_day = $2
                AND wls.leaderboard_time = $1)
    `, [formatHHMM(now), now.getDay()]);

    for (const league of leagues.rows) {
        const text = await buildLeaderboardMessage(league.league_id, league.league_name);
        await client.sendMessage(league.wa_group_id, text);
    }
});
```

### פורמט הטבלה

```
📊 טבלת ליגת "חברים של אבי"
━━━━━━━━━━━━━━━━━━━━━━
🥇 ישראל — 2,450 נקודות
🥈 שרה — 2,100 נקודות
🥉 דוד — 1,800 נקודות
4. רונן — 1,500 נקודות
5. מיכל — 1,200 נקודות
━━━━━━━━━━━━━━━━━━━━━━
```

---

## 13. סיום ליגה/טורניר

### טריגר
כשמנהל הליגה לוחץ "סגור ליגה" (settle), או כשהאוטו-סטל רץ:

```javascript
// backend/src/routes/leagues.js — settleLeaguePool()
await whatsappBotService.notifyLeagueEnd(leagueId);
```

### הודעת סיום

```
🏆🏆🏆 ליגת "חברים של אבי" הסתיימה! 🏆🏆🏆

📊 תוצאות סופיות:
🥇 ישראל — 2,450 נקודות [+1,500 מהפרס!]
🥈 שרה — 2,100 נקודות [+900 מהפרס!]
🥉 דוד — 1,800 נקודות [+600 מהפרס!]
4. רונן — 1,500 נקודות
5. מיכל — 1,200 נקודות

כל הכבוד לכולם! 🎉
```

---

## 14. סנכרון WhatsApp ↔ אתר

### כל הימור WhatsApp = הימור רגיל ב-DB

כל הימור שנוצר דרך WhatsApp נשמר בטבלת `bets` הקיימת עם:
- `wa_bet = true`
- `wa_source = 'group' | 'dm'`
- `wa_bet_message_id` — ה-message ID של הודעת המשתמש

**תוצאה:** הימורים מ-WhatsApp מופיעים:
- בדף פרופיל (bet history)
- בדף "ההימורים שלי"
- בדירוג הליגה
- מסתדרים בדיוק כמו הימור רגיל

### הימור מהאתר מופיע ב-WhatsApp

כשמשתמש מהמר באתר על משחק שנשלחה עליו הודעת WhatsApp — הבוט **אינו** שולח עדכון לקבוצה (יהיה ספאמי). הסנכרון נראה רק בתוצאות הסופיות.

### עדכון בזמן אמת

מכיוון שכל bet נמצא ב-DB, כל endpoint ב-backend שמחשב rankings/points כולל גם הימורי WhatsApp אוטומטית.

---

## 15. State Machine — DM פרטי

### מתי הstate machine פעיל?

ה-state machine (idle/selecting_game/...) רלוונטי רק ל-**DM חופשי** (פקודות כמו `/bet`, `/balance`).  
הימורים דרך **reply להודעת משחק** — אינם דורשים state machine, הם context-aware לפי ה-quoted message.

### פקודות DM

| פקודה | תגובה |
|--|--|
| `/help` / `עזרה` | תפריט ראשי |
| `/games` / `משחקים` | 5 משחקים קרובים פתוחים |
| `/bet` | זרם הימור אינטראקטיבי (state machine) |
| `/balance` / `יתרה` | יתרת נקודות |
| `/mybets` | 5 הימורים אחרונים |
| `/leagues` | ליגות פעילות |
| `ביטול` | ביטול פעולה פעילה |

### מצבים

```
idle
  ── /bet ──→ שלח 5 משחקים → selecting_game
  ── /balance → יתרה → idle
  ── /games → רשימת משחקים → idle
  ── /mybets → הימורים אחרונים → idle
  ── [reply על הודעת משחק] → processBetReply() → idle

selecting_game
  ── [1-5] → שלח אפשרויות → selecting_outcome
             context: { game_id, game_label, questions }
  ── "ביטול" → idle

selecting_outcome
  ── [1-N] → בקש סכום → entering_stake
             context: { ...prev, question_id, outcome_label, odds }
  ── "ביטול" → idle

entering_stake
  ── [מספר תקין] → הצג אישור → confirming_bet
  ── [מספר > יתרה] → שגיאה → entering_stake
  ── "ביטול" → idle

confirming_bet
  ── "כן" / "אשר" → בצע הימור → idle
  ── "לא" / "ביטול" → idle
```

Session timeout: `last_msg_at < NOW() - 30 minutes` → reset to idle.

---

## 16. סכמת DB

### שינויים בטבלאות קיימות

```sql
-- users
ALTER TABLE users
  ADD COLUMN phone_number   VARCHAR(20) UNIQUE,
  ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN wa_opt_in      BOOLEAN NOT NULL DEFAULT true;

-- bets — הוספת שדות WhatsApp
ALTER TABLE bets
  ADD COLUMN is_free_bet        BOOLEAN NOT NULL DEFAULT false,
  -- true = סכום התחלתי mode, stake=0, לא מנוכה מיתרה
  ADD COLUMN wa_bet             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN wa_source          VARCHAR(10),
  -- 'group' | 'dm'
  ADD COLUMN wa_bet_message_id  TEXT;
  -- ה-message ID של הודעת המשתמש (לזיהוי תיקון הימור)
```

---

### טבלאות חדשות

```sql
-- הגדרות WhatsApp לליגה
CREATE TABLE wa_league_settings (
  league_id                UUID PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
  bet_mode                 VARCHAR(20) NOT NULL DEFAULT 'prediction',
  -- 'prediction' (סכום התחלתי) | 'fixed' (סכום קבוע)
  stake_amount             INTEGER NOT NULL DEFAULT 0,
  -- prediction mode: 0 | fixed mode: הסכום הקבוע
  exact_score_enabled      BOOLEAN NOT NULL DEFAULT false,
  morning_message_time     TIME NOT NULL DEFAULT '09:00',
  reminder_hours_before    DECIMAL(4,1),
  -- NULL = אין תזכורת; 2.5 = שעתיים וחצי לפני
  leaderboard_frequency    VARCHAR(20) NOT NULL DEFAULT 'after_game',
  -- 'never' | 'after_game' | 'daily' | 'weekly'
  leaderboard_time         TIME,
  -- לdaily/weekly
  leaderboard_day          INTEGER
  -- 0=ראשון ... 6=שבת (לweekly)
);

-- קבוצות WhatsApp מקושרות לליגות
CREATE TABLE wa_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_group_id VARCHAR(200) UNIQUE NOT NULL,
  -- JID: XXXXXXXXXX-XXXXXXXXXX@g.us
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  invite_link TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- הודעות בוקר שנשלחו (לזיהוי replies)
CREATE TABLE wa_game_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  wa_message_id TEXT NOT NULL UNIQUE,
  -- WhatsApp message ID (_serialized)
  group_jid     VARCHAR(200),
  -- NULL אם DM
  dm_phone      VARCHAR(20),
  -- NULL אם קבוצה
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wa_game_msg_id ON wa_game_messages(wa_message_id);
CREATE INDEX idx_wa_game_msg_game ON wa_game_messages(game_id, league_id);

-- תזכורות שנשלחו (למניעת כפילויות)
CREATE TABLE wa_reminders_sent (
  league_id  UUID REFERENCES leagues(id) ON DELETE CASCADE,
  game_id    UUID REFERENCES games(id) ON DELETE CASCADE,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, game_id)
);

-- קודי OTP לאימות מספר
CREATE TABLE wa_verification_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone       VARCHAR(20) NOT NULL,
  code        VARCHAR(6) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wa_codes_expires ON wa_verification_codes(expires_at);

-- שיחות פעילות (State Machine)
CREATE TABLE wa_sessions (
  phone       VARCHAR(20) PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  state       VARCHAR(50) NOT NULL DEFAULT 'idle',
  context     JSONB NOT NULL DEFAULT '{}',
  last_msg_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- הודעות ממתינות לשליחה (fallback אם internal API לא זמין)
CREATE TABLE wa_pending_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      VARCHAR(20),
  group_jid  VARCHAR(200),
  text       TEXT NOT NULL,
  sent       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wa_pending_unsent ON wa_pending_messages(sent, created_at) WHERE NOT sent;

-- לוג לניטור
CREATE TABLE wa_message_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction  VARCHAR(10) NOT NULL, -- 'in' | 'out'
  phone      VARCHAR(20),
  group_jid  VARCHAR(200),
  message    TEXT,
  state_from VARCHAR(50),
  state_to   VARCHAR(50),
  action     VARCHAR(100),
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wa_log_phone ON wa_message_log(phone, created_at DESC);
```

### שינויים ב-`leagues`

```sql
ALTER TABLE leagues
  ADD COLUMN wa_enabled BOOLEAN NOT NULL DEFAULT false;
```

---

## 17. API Routes

### Backend — `backend/src/routes/whatsapp.js`

| Method | Path | Auth | תיאור |
|--|--|--|--|
| `POST` | `/api/whatsapp/link-phone` | JWT | שולח OTP |
| `POST` | `/api/whatsapp/verify` | JWT | מאמת OTP |
| `DELETE` | `/api/whatsapp/unlink` | JWT | ניתוק מספר |
| `GET` | `/api/whatsapp/status` | JWT | סטטוס קישור |
| `PATCH` | `/api/whatsapp/opt-in` | JWT | הגדרות הודעות |
| `POST` | `/api/whatsapp/leagues/:id/create-group` | JWT (Creator) | יצירת קבוצה חדשה |
| `POST` | `/api/whatsapp/leagues/:id/link-group` | JWT (Creator) | קישור קבוצה קיימת |
| `DELETE` | `/api/whatsapp/leagues/:id/group` | JWT (Creator) | ניתוק קבוצה |
| `GET` | `/api/whatsapp/leagues/:id/settings` | JWT | קריאת הגדרות WA לליגה |
| `PUT` | `/api/whatsapp/leagues/:id/settings` | JWT (Creator) | עדכון הגדרות |

### Internal API (Bot → Backend, port 4001)

| Method | Path | Auth | תיאור |
|--|--|--|--|
| `POST` | `/internal/send` | INTERNAL_KEY | DM לטלפון |
| `POST` | `/internal/send-group` | INTERNAL_KEY | הודעה לקבוצה |
| `POST` | `/internal/create-group` | INTERNAL_KEY | יצירת קבוצה |
| `POST` | `/internal/add-member` | INTERNAL_KEY | הוספת חבר |
| `POST` | `/internal/react` | INTERNAL_KEY | React על הודעה |

### קבצים קיימים שמשתנים

| קובץ | שינוי |
|--|--|
| `backend/src/jobs/settleBets.js` | + `notifyGameResult(gameId)` אחרי settle |
| `backend/src/jobs/featuredNotifications.js` | + `notifyFeaturedGame()` לmembers |
| `backend/src/routes/leagues.js` | + `addToGroup()` בjoin, + `notifyLeagueEnd()` בsettle |
| `backend/src/app.js` | + `app.use('/api/whatsapp', whatsappRoutes)` |

---

## 18. תשתית ו-Deployment

### ENV Variables

```bash
# Backend (Railway)
BOT_INTERNAL_URL=http://localhost:4001
INTERNAL_API_KEY=<random_strong_secret>
APP_FRONTEND_URL=https://kickoff.app

# Bot Process
BOT_INTERNAL_PORT=4001
DATABASE_URL=<same as backend>
INTERNAL_API_KEY=<same as backend>
BOT_PHONE=972XXXXXXXXX        # מספר הבוט (לlinks וsetup message)
```

### Session Persistence (Railway Volume)

```
Railway Dashboard → Service → Volumes
Mount Path: /app/whatsapp-bot/.wwebjs_auth
```

ללא volume — QR נדרש בכל restart.

### ecosystem.config.js

```javascript
module.exports = {
    apps: [{
        name: 'kickoff-wa-bot',
        script: 'bot.js',
        cwd: './whatsapp-bot',
        max_memory_restart: '400M',
        restart_delay: 5000,
        max_restarts: 10,
    }]
};
```

---

## 19. מפת קבצים

```
bet-joy-league-hub/
│
├── backend/src/
│   ├── routes/
│   │   └── whatsapp.js                 ← חדש
│   ├── services/
│   │   └── whatsappBotService.js       ← חדש: sendMessage, notifyGameResult...
│   ├── jobs/
│   │   ├── settleBets.js               ← שינוי: + notifyGameResult
│   │   └── featuredNotifications.js   ← שינוי: + notify WA
│   ├── routes/
│   │   └── leagues.js                  ← שינוי: + addToGroup, notifyLeagueEnd
│   ├── app.js                          ← שינוי: + whatsapp routes
│   └── db/schema.sql                   ← שינוי: + wa_* tables
│
├── whatsapp-bot/                        ← חדש לחלוטין
│   ├── bot.js                          ← entry point
│   ├── ecosystem.config.js             ← PM2
│   ├── package.json
│   ├── .wwebjs_auth/                   ← gitignored, Railway volume
│   └── src/
│       ├── internalApi.js              ← HTTP server (port 4001)
│       ├── stateRouter.js              ← State Machine לDM
│       ├── rateLimiter.js
│       ├── scheduledJobs.js            ← morning messages, reminders, leaderboard, session cleanup
│       ├── handlers/
│       │   ├── dmHandler.js            ← DM messages
│       │   ├── groupHandler.js         ← Group messages + reply detection
│       │   └── groupEvents.js          ← join/leave/update
│       ├── commands/
│       │   ├── betCommands.js          ← /bet flow + processBetReply
│       │   ├── infoCommands.js         ← /balance, /games, /mybets
│       │   └── groupCommands.js        ← /kickoff setup
│       ├── notifications/
│       │   ├── morningMessages.js      ← בניית + שליחת הודעות בוקר
│       │   ├── resultNotifier.js       ← הודעת תוצאה + ניקוד
│       │   ├── reminderNotifier.js     ← תזכורת @mentions
│       │   └── leaderboardNotifier.js  ← שליחת טבלה
│       └── utils/
│           ├── phoneUtils.js           ← parsePhoneNumber, extractNumber
│           ├── formatters.js           ← formatPoints, buildGameMessage
│           └── db.js                   ← PostgreSQL pool
│
└── src/ (Frontend)
    ├── pages/
    │   ├── ProfilePage.tsx             ← שינוי: + WhatsApp section
    │   ├── LeagueDetailPage.tsx        ← שינוי: + WhatsApp group section
    │   └── AdminDashboard.tsx          ← שינוי: + WhatsApp tab
    └── lib/api.ts                      ← שינוי: + whatsapp API calls
```

---

## 20. סדר מימוש

```
שלב 1 — תשתית Backend + Frontend ✅ הושלם
  ✅ wa_* tables: migration (כולל wa_groups, wa_league_settings, wa_verification_codes, wa_sessions)
  ✅ Backend: כל whatsapp routes (link-phone, verify, unlink, status, opt-in,
              create-group, link-group, refresh-invite-link, invite-link, settings)
  ✅ whatsappBotService.js: sendDM + callBot עם STUB_MODE

שלב 2 — קישור משתמש ✅ הושלם
  ✅ OTP flow (link-phone + verify)
  ✅ ProfilePage: WhatsApp section (משולב תחת הגדרות)

שלב 3 — חיבור קבוצה ✅ הושלם (צד Backend + Frontend בלבד)
  ✅ API: create-group, link-group, refresh-invite-link, invite-link
  ✅ LeagueDetailPage: WhatsApp section עם invite link UI
  ⏳ הבוט עצמו (internal API) — ממתין לחיבור SIM

שלב A — הבוט עולה ← הצעד הבא (אחרי חיבור SIM)
  ✅ whatsapp-bot/bot.js + whatsapp-web.js + LocalAuth session
  ✅ whatsapp-bot/src/internalApi.js (port 4001)
  ✅ Railway: railway.json + ecosystem.config.js + Volume documented

שלב B — הודעות בוקר + הימור ב-reply
  ✅ wa_game_messages migration (כבר קיים בschema.sql)
  ✅ scheduledJobs.js + morningMessages.js
  ✅ groupHandler.js + processBetReply() + bet correction

שלב C — תזכורות + תוצאות
  ✅ wa_reminders_sent migration (כבר קיים בschema.sql)
  ✅ reminderNotifier.js
  ✅ resultNotifier.js (trigger מ-settleBets.js — דרך whatsappBotService.js)
  ☐ leaderboardNotifier.js

שלב D — DM State Machine
  ✅ dmHandler.js + stateRouter.js
  ✅ פקודות: יתרה, משחקים, הימורים, עזרה
```

---

*תאריך עדכון: 19.4.2026*
