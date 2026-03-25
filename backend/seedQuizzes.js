require('dotenv').config();
const { pool } = require('./src/config/database');

const questions = [
  {
    question_text: "מי מלך השערים של ליגת האלופות בכל הזמנים?",
    options: ["כריסטיאנו רונאלדו", "ליונל מסי", "רוברט לבנדובסקי", "קארים בנזמה"],
    correct_option: "A",
    category: "general",
    points_reward: 100
  },
  {
    question_text: "איזו נבחרת זכתה במונדיאל 2022?",
    options: ["צרפת", "ארגנטינה", "ברזיל", "מרוקו"],
    correct_option: "B",
    category: "general",
    points_reward: 100
  },
  {
    question_text: "באיזו קבוצה משחק ארלינג הולאנד (2024)?",
    options: ["באיירן מינכן", "ריאל מדריד", "מנצ'סטר סיטי", "בורוסיה דורטמונד"],
    correct_option: "C",
    category: "general",
    points_reward: 50
  }
];

async function seedQuizzes() {
  for (const q of questions) {
    await pool.query(
      `INSERT INTO quiz_questions (question_text, options, correct_option, category, points_reward)
       VALUES ($1, $2, $3, $4, $5)`,
      [q.question_text, JSON.stringify(q.options), q.correct_option, q.category, q.points_reward]
    );
  }
  console.log('Seeded quiz questions.');
  process.exit(0);
}

seedQuizzes().catch(e => { console.error(e); process.exit(1); });
