const Groq = require('groq-sdk');

let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

async function generateQuizQuestion(options) {
  const categoryNames = {
    'general': 'כללי',
    'history': 'היסטוריה',
    'players': 'שחקנים',
    'clubs': 'קבוצות',
    'world_cup': 'מונדיאל'
  };

  const category = (typeof options === 'string') ? options : (options.category || 'general');
  const categoryName = categoryNames[category] || category;

  const angleSuggestions = {
    'general': ['העשור האחרון', 'שנות ה-90', 'ליגת האלופות', 'ליגה האנגלית', 'ליגה הספרדית', 'שיאים', 'העברות'],
    'history': ['שנות ה-70', 'שנות ה-80', 'שנות ה-60', 'ראשית הכדורגל המקצועי', 'היסטוריה של מונדיאל'],
    'players': ['קשרים', 'חלוצים', 'שוערים', 'מגנים', 'שחקנים ברזילאים', 'שחקנים ארגנטינאים', 'שחקנים אנגלים'],
    'clubs': ['קבוצות איטלקיות', 'קבוצות גרמניות', 'קבוצות ספרדיות', 'קבוצות אנגליות', 'ארגמנטינאיות', 'קבוצות צרפתיות'],
    'world_cup': ['פינאלים', 'שוערים', 'מארגנות', 'שיאים', 'מפתיעות', 'כדורגלניות מפורסמות']
  };
  const angles = angleSuggestions[category] || angleSuggestions['general'];
  const randomAngle = angles[Math.floor(Math.random() * angles.length)];
  const randomSeed = Math.floor(Math.random() * 10000);

  let topicInstruction = `עליך ליצור שאלת טריוויה חדשה, מקורית ומעניינת בנושא: "${categoryName}". התמקד בזווית: "${randomAngle}". (seed: ${randomSeed})`;
  if (options.customTopic) {
    let context = 'בנושא';
    if (options.customType === 'team') context = 'על הקבוצה';
    else if (options.customType === 'player') context = 'על השחקן';
    else if (options.customType === 'competition') context = 'על התחרות';

    topicInstruction = `עליך ליצור שאלת טריוויה חדשה, מרתקת ומדויקת ${context}: "${options.customTopic}". השאלה חייבת להיות ספציפית וממוקדת בנושא זה בלבד! (seed: ${randomSeed})`;
  }

const prompt = `
אתה מחולל שאלות טריוויה לאפליקציית כדורגל. עליך להיות היסטוריון כדורגל קפדן ומדויק.
אזהרה חמורה: אל תמציא (Hallucinate) עובדות, שחקנים, אירועים או נתונים סטטיסטיים!
השתמש אך ורק בעובדות היסטוריות אמיתיות וודאיות ב-100% (למשל: זוכי מונדיאל, מלכי שערים, שיאי העברות רשמיים, שנות הקמה וזכייה מוכרות). אם אתה לא בטוח בעובדה, אל תשתמש בה.
${topicInstruction}
השאלה חייבת להיות בעברית תקינה.
החזר אך ורק תשובת JSON תקני ללא שום טקסט, הערות, או תוספות לפני או אחרי ה-JSON.
פורמט ה-JSON חייב להיות בדיוק:
{
  "question_text": "ניסוח השאלה כאן?",
  "options": ["A. תשובה א", "B. תשובה ב", "C. תשובה ג", "D. תשובה ד"],
  "correct_option": "B"
}
כאשר correct_option היא אחת מהאותיות A, B, C, D בלבד — ללא טקסט נוסף.
וודא שהתשובה הנכונה משתקפת במערך ה-options (אם correct_option היא B, פריט מספר 2 יהיה התשובה הנכונה).
`;

  try {
    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 500,
    });

    const responseText = completion.choices[0].message.content;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid output from AI");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[generateQuizQuestion] AI Error:", err);
    throw new Error("AI Error: " + (err.error?.error?.message || err.message));
  }
}

async function verifyBox2Box(team1, team2, guess) {
  const prompt = `
אתה שופט נתונים מדויק של כדורגל.
עליך לבדוק האם השחקן המכונה "${guess}" שיחק אי פעם משחקים רשמיים בקבוצות הבוגרים של **שני המועדונים הבאים**:
1. ${team1}
2. ${team2}

השב "true" אך ורק אם השחקן אכן שיחק משחקים רשמיים (ולא רק נוער או משחקי ידידות) בשתי הקבוצות לאורך הקריירה שלו.
אם הוא שיחק רק באחת מהן, או באף אחת מהן, השב "false".
לדוגמה: אם יזינו 'Ronaldo' וקבוצות 'Real Madrid' ו-'Barcelona', התשובה היא "true" (רונאלדו הברזילאי).
השב מילה אחת בלבד באנגלית - true או false. ללא שום סימן פיסוק נוסף.
`;

  try {
    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 10,
    });

    const responseText = completion.choices[0].message.content.trim().toLowerCase();
    return responseText.includes('true');
  } catch (err) {
    console.error("[verifyBox2Box] AI Error:", err);
    return false; // Err on the side of rejection
  }
}

module.exports = { generateQuizQuestion, verifyBox2Box };

async function generateWhoAreYaContext(recentPlayers = []) {
  const prompt = `
אתה מומחה כדורגל. עליך לבחור שחקן כדורגל פעיל כיום (נכון ל-2024-2025) המוכר ברמה עולמית ומשחק בליגות המובילות, ולספק נתונים בסיסיים לגביו למשחק חשיפה.
חשוב: בחר אך ורק שחקנים שמשחקים פעיל כיום בקבוצה. אין לבחור שחקנים שפרשו, גמלאים, או שהקריירה המקצועית שלהם הסתיימה.
אזהרה! אסור לך בשום אופן לבחור באחד מהשחקנים הבאים שכבר היו במשחק לאחרונה:
[${recentPlayers.join(', ')}]

החזר אך ורק תשובת JSON חוקית בפורמט הבא:
{
  "name": "שם השחקן באנגלית בלבד (לדוגמה Kylian Mbappé)",
  "name_he": "שם השחקן בעברית מלאה ותקנית (לדוגמה קיליאן אמבפה)",
  "wikiSlug": "שם השחקן כפי שהוא מופיע בנתיב ה-URL בויקיפדיה האנגלית",
  "club": "הקבוצה הנוכחית או האחרונה שבה שיחק בוודאות באנגלית",
  "club_he": "שם הקבוצה הנוכחית בעברית",
  "nat": "מולדת/לאום השחקן באנגלית",
  "nat_he": "מולדת/לאום השחקן בעברית",
  "pos": "עמדה על המגרש באנגלית (לדוגמה Forward, Midfielder, Defender, Goalkeeper)",
  "pos_he": "עמדה על המגרש בעברית (לדוגמה חלוץ, קשר, מגן, שוער)"
}
`;
  return await fetchJsonResponse(prompt);
}

async function generateCareerPathContext(recentPlayers = []) {
  const prompt = `
אתה מומחה כדורגל היסטורי. עליך לבחור שחקן כדורגל מפורסם מאוד, עבר או הווה, ששיחק לפחות ב-4 קבוצות שונות (רצוי בקבוצות ידועות) לאורך הקריירה, על מנת שהמשתמשים ינחשו מי הוא לפי המסלול שלו.
אזהרה! אסור לך בשום אופן לבחור באחד מהשחקנים הבאים:
[${recentPlayers.join(', ')}]

החזר אך ורק תשובת JSON חוקית בפורמט הבא:
{
  "name": "שם השחקן באנגלית",
  "name_he": "שם השחקן בעברית",
  "wikiSlug": "שם השחקן כפי שמופיע בנתיב הויקיפדיה האנגלית שלו",
  "clubs": ["Club 1", "Club 2", "Club 3", "Club 4"], // רשימה כרונולוגית של קבוצות באנגלית
  "clubs_he": ["קבוצה 1", "קבוצה 2", "קבוצה 3", "קבוצה 4"] // אותה רשימה בדיוק בעברית
}
`;
  return await fetchJsonResponse(prompt);
}

async function generateBox2BoxContext(recentPlayers = []) {
  const prompt = `
אתה מומחה כדורגל. עליך לבחור שחקן מפורסם מאוד ששיחק במשחקים רשמיים בשתי קבוצות ענק ידועות באירופה, כך שמשתמשים יצטרכו למצוא שחקן שמקשר ביניהן. עליך לבחור שחקן שאינו טריוויאלי מדי אבל מוכר.
אזהרה! מצא שחקן שאינו ברשימה הבאה:
[${recentPlayers.join(', ')}]

החזר אך ורק תשובת JSON חוקית בפורמט הבא:
{
  "secret_player": "שם השחקן המקשר באנגלית",
  "secret_player_he": "שם השחקן המקשר בעברית",
  "team1": "הקבוצה הראשונה בה שיחק באנגלית",
  "team1_he": "הקבוצה הראשונה בעברית",
  "team2": "הקבוצה השנייה בה שיחק באנגלית",
  "team2_he": "הקבוצה השנייה בעברית"
}
`;
  return await fetchJsonResponse(prompt);
}

async function fetchJsonResponse(prompt) {
  try {
    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    });
    const responseText = completion.choices[0].message.content;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid output from AI");
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[AI Generator Error]", err);
    throw new Error("AI Generator Error: " + (err.error?.error?.message || err.message));
  }
}

module.exports = { 
  generateQuizQuestion, 
  verifyBox2Box,
  generateWhoAreYaContext,
  generateCareerPathContext,
  generateBox2BoxContext
};
