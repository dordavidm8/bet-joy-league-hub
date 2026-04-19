# Kickoff WhatsApp Bot

## הגדרת סביבה

צור קובץ `.env` לפי `.env.example`:

```
DATABASE_URL=postgresql://...     # אותו DATABASE_URL כמו הbackend
INTERNAL_API_KEY=<סוד חזק>       # אותו מפתח שמוגדר בbackend
BOT_INTERNAL_PORT=4001
BOT_PHONE=972XXXXXXXXX            # המספר שחיברת לבוט (אחרי סריקת QR)
NODE_ENV=production
```

## הרצה מקומית

```bash
npm install
node bot.js
```

בהרצה ראשונה יוצג QR בטרמינל — סרוק עם הטלפון שמחובר ל-SIM.

## Railway Deployment

1. צור service חדש ב-Railway בתוך הפרויקט
2. Root directory: `whatsapp-bot/`
3. הוסף Volume: Mount Path = `/app/whatsapp-bot/.wwebjs_auth`
4. הגדר ENV variables (ראה .env.example)
5. לאחר deploy ראשון — צפה בלוגים לQR, סרוק, הבוט יתחבר

## ENV Variables ב-Backend (Railway)

ודא שאלה מוגדרים גם בservice של הbackend:
```
BOT_INTERNAL_URL=http://<bot-service-name>.railway.internal:4001
INTERNAL_API_KEY=<אותו מפתח>
```

## מבנה קבצים

```
whatsapp-bot/
├── bot.js                        # Entry point
├── src/
│   ├── internalApi.js            # REST server (port 4001) — מאזין לbackend
│   ├── scheduledJobs.js          # Cron: הודעות בוקר, תזכורות, טבלה
│   ├── handlers/
│   │   ├── groupHandler.js       # הודעות קבוצה + reply-to-bet
│   │   ├── dmHandler.js          # הודעות DM + פקודות
│   │   └── stateRouter.js        # State machine לשיחות DM
│   ├── notifications/
│   │   ├── morningMessages.js    # שליחת הודעות בוקר
│   │   ├── leaderboardNotifier.js# שליחת טבלה
│   │   └── reminderNotifier.js   # תזכורות לפני נעילה
│   └── utils/
│       ├── db.js                 # PostgreSQL pool
│       ├── phoneUtils.js         # normalizePhone, toJid, extractNumber
│       └── formatters.js         # buildGameMessage, buildLeaderboardMessage
```
