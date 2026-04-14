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
  
  let topicInstruction = `עליך ליצור שאלת טריוויה חדשה, מקורית ומעניינת בנושא: "${categoryName}".`;
  if (options.customTopic) {
    let context = 'בנושא';
    if (options.customType === 'team') context = 'על הקבוצה';
    else if (options.customType === 'player') context = 'על השחקן';
    else if (options.customType === 'competition') context = 'על התחרות';

    topicInstruction = `עליך ליצור שאלת טריוויה חדשה, מרתקת ומדויקת ${context}: "${options.customTopic}". השאלה חייבת להיות ספציפית וממוקדת בנושא זה בלבד!`;
  }

const prompt = `
אתה מחולל שאלות טריוויה לאפליקציית כדורגל. עליך להיות היסטוריון כדורגל קפדן ומדויק.
אזהרה חמורה: אל תמציא (Hallucinate) עובדות, שחקנים, אירועים או נתונים סטטיסטיים! 
השתמש אך ורק בעובדות היסטוריות אמיתיות וודאיות ב-100% (למשל: זוכי מונדיאל, מלכי שערים, שיאי העברות רשמיים, שנות הקמה וזכייה מוכרות). אם אתה לא בטוח בעובדה, אל תשתמש בה.
${topicInstruction}
השאלה חייבת להיות בעברית תקינה.
החזר אך ורק תשובת JSON ללא שום טקסט נוסף.
פורמט ה-JSON חייב להיות:
{
  "question_text": "ניסוח השאלה כאן?",
  "options": ["A. תשובה א", "B. תשובה ב", "C. תשובה ג", "D. תשובה ד"],
  "correct_option": "B" // אחת מהאותיות A, B, C, או D המתאימה לתשובה הנכונה
}
וודא שהתשובה הנכונה משתקפת היטב במערך ה-options (דהיינו, אם correct_option היא B, אז פריט מספר 2 במערך יהיה 'B. התשובה הנכונה') ושהיא בוודאות האמת.
`;

  try {
    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
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
