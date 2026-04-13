const Groq = require('groq-sdk');

let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

async function generateQuizQuestion(category) {
  const categoryNames = {
    'general': 'כללי',
    'history': 'היסטוריה',
    'players': 'שחקנים',
    'clubs': 'קבוצות',
    'world_cup': 'מונדיאל'
  };

  const categoryName = categoryNames[category] || category;

  const prompt = `
אתה מחולל שאלות טריוויה לאפליקציית כדורגל.
עליך ליצור שאלת טריוויה חדשה, מקורית ומעניינת בנושא תחרות הכדורגל "${categoryName}".
השאלה חייבת להיות בעברית תקינה.
החזר אך ורק תשובת JSON ללא שום טקסט נוסף.
פורמט ה-JSON חייב להיות:
{
  "question_text": "ניסוח השאלה כאן?",
  "options": ["A. תשובה א", "B. תשובה ב", "C. תשובה ג", "D. תשובה ד"],
  "correct_option": "B" // אחת מהאותיות A, B, C, או D המתאימה לתשובה הנכונה
}
וודא שהתשובה הנכונה משתקפת היטב במערך ה-options (דהיינו, אם correct_option היא B, אז פריט מספר 2 במערך יהיה 'B. התשובה הנכונה').
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

module.exports = { generateQuizQuestion };
