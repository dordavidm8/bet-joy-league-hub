require('dotenv').config();
const { generateQuizQuestion } = require('./src/services/aiAdminService');
(async () => {
  try {
    const res = await generateQuizQuestion('general');
    console.log("Success:", res);
  } catch(e) {
    console.error("Failed:", e.message);
  }
})();
