require('dotenv').config();
const { chat } = require('./src/services/advisorService');
(async () => {
  try {
    const res = await chat(1, "user123", [{role: "user", content: "hello"}]);
    console.log("Success:", res);
  } catch(e) {
    console.error("Failed:", e);
  }
})();
