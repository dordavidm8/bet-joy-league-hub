require('dotenv').config({ path: './backend/.env' });
const { generateQuizQuestion } = require('./backend/src/services/aiAdminService');
(async () => {
  try {
    const res = await generateQuizQuestion('general');
    console.log("Success:", res);
  } catch(e) {
    console.error("Failed:", e.message);
  }
})();
