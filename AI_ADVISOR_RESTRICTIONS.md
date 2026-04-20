# AI Advisor - הגבלות וביטחון

## סקירה כללית

המערכת כוללת יועץ AI מבוסס Llama 3.3 70B עם tool calling שמספק ניתוח משחקים והמלצות הימורים. כדי למנוע בזבוז API calls וללהניח חוויית משתמש טובה יותר, היועץ מוגבל לעבוד **רק על משחקים מתוכננים** (status: 'scheduled').

## מגבלות הגישה

### סוגי משחקים מותרים
- ✅ **משחקים מתוכננים** (`scheduled`) - יועץ פעיל ומלא
- ❌ **משחקים חיים** (`live`) - "לא ניתן לשאול על משחק חי - השתמש בעמוד המשחק"
- ❌ **משחקים מוגמרים** (`finished`) - "לא ניתן לשאול על משחק שנגמר"  
- ❌ **משחקים נדחו** (`postponed`) - "המשחק נדחה - המתן לעדכון מועד חדש"
- ❌ **משחקים בוטלו** (`cancelled`) - "המשחק בוטל"

### מגבלות שימוש יומיות
- **20 שאלות למשתמש ליום** 
- ספירה מתאפסת בחצות
- שגיאה 429 כשמגיעים למגבלה: "הגעת למגבלת השימוש היומית (20 הודעות)"

## יתרונות המגבלות

### חיסכון בעלויות API
- **Groq API**: $0.59/1M tokens → שאלה טיפוסית עם tools = ~2000 tokens
- **The Odds API**: 500 requests/month חינם → חשוב לא לבזבז על odd checks למשחקים מוגמרים
- **מניעת בזבוז**: משתמשים לא יכלו את המכסה על שאלות לא רלוונטיות

### חוויית משתמש טובה יותר
- **יעוץ רלוונטי**: ניתוח רק על משחקים עתידיים שניתן להמר עליהם
- **הודעות שגיאה ברורות**: מסביר למשתמש למה הבקשה נדחתה
- **מניעת בלבול**: לא לקבל יעוץ על משחק שכבר נגמר

## מימוש טכני

### Backend Validation
```javascript
// advisorService.js - getGameContext()
if (!skipStatusCheck && game.status !== 'scheduled') {
  const statusErrors = {
    'live': 'לא ניתן לשאול על משחק חי - השתמש בעמוד המשחק',
    'finished': 'לא ניתן לשאול על משחק שנגמר',
    'postponed': 'המשחק נדחה - המתן לעדכון מועד חדש',
    'cancelled': 'המשחק בוטל'
  };
  const err = new Error(statusErrors[game.status] || `משחק בסטטוס '${game.status}' לא זמין ליועץ`);
  err.status = 403;
  throw err;
}
```

### Admin Playground Bypass
למנהלים יש גישה ל-playground שעוקף את ההגבלות לצורך debugging:
```javascript
// Admin route - playground bypass
const skipStatusCheck = true;
await chatStream(gameId, userId, messages, onEvent, skipStatusCheck);
```

### Frontend Error Handling  
```javascript
// ExpertChatPage.tsx
if (msg.includes("לא ניתן לשאול")) {
  errorContent = `⚠️ ${msg}`;
}
```

## API Endpoints

### משתמשים רגילים
- `POST /api/advisor/:gameId` - JSON response (blocked for non-scheduled games)
- `GET /api/advisor/:gameId/stream` - SSE streaming (blocked for non-scheduled games)

### מנהלים
- `GET /api/admin/advisor/playground` - עוקף הגבלות סטטוס

## Status Codes

| Code | משמעות | דוגמה |
|------|---------|--------|
| 200 | הצלחה | יועץ פעיל על משחק מתוכנן |
| 403 | גישה נדחתה | משחק לא מתוכנן |
| 404 | לא נמצא | gameId לא קיים |
| 429 | יותר מדי בקשות | עבר מגבלת 20 ליום |

## דוגמאות שימוש

### בקשה תקינה (משחק מתוכנן)
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/advisor/123/stream?messages=[{\"role\":\"user\",\"content\":\"על מי כדאי להמר?\"}]"

# תגובה: ניתוח מלא עם tool calling
```

### בקשה נדחית (משחק מוגמר) 
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/advisor/456/stream?messages=[{\"role\":\"user\",\"content\":\"איך היה המשחק?\"}]"

# תגובה: 403 {"error": "לא ניתן לשאול על משחק שנגמר"}
```

## כלי ניטור

### Advisor Metrics
המערכת רושמת events לטבלת `advisor_metrics`:
- `llm_call` - קריאות ל-Groq API
- `tool_call` - הפעלת כלים (team_form, head_to_head וכו')
- `error` - שגיאות במהלך עיבוד

### Daily Usage Tracking
טבלת `advisor_usage` עוקבת אחר שימוש יומי למשתמש.

---

**הטמעה**: השינוי הוטמע ב-`feature/ai-advisor-admin` branch וכולל walidation מלא בbackend, טיפול שגיאות בfrontend, ו-admin bypass לdebugging.