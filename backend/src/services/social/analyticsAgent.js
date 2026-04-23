/**
 * analyticsAgent.js – סוכן אנליטיקה
 *
 * analyzePerformance() –
 *   מביא מדדי engagement מהפלטפורמות (impressions, likes, shares).
 *   מחשב engagement rate לכל פוסט.
 *   שומר ב-social_post_analytics table.
 */
const { pool } = require('../../config/database');
const { getGroqClient, getSocialConfig } = require('./socialMediaUtils');

/**
 * Weekly Analytics Agent
 * Pulls the raw DB analytics stats for the last 7 or 30 days and uses Groq
 * to provide human-readable insights (Best time to post, top hashtags, overall trends).
 */
async function generateAnalyticsInsights(days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 1. Fetch RAW data
  const postsRes = await pool.query(
    `SELECT p.id, p.platform, p.caption, p.hashtags, p.published_at, 
            a.impressions, a.likes, a.comments, a.shares 
     FROM social_posts p
     JOIN social_post_analytics a ON a.post_id = p.id
     WHERE p.status = 'published' AND p.published_at >= $1
     ORDER BY p.published_at DESC`,
    [cutoff]
  );

  const posts = postsRes.rows;
  if (posts.length === 0) {
    console.log('[AnalyticsAgent] No published posts in the time frame to analyze.');
    return "לא נמצאו נתונים מעניינים להפיק מהם תובנות בטווח הזמן הזה.";
  }

  // Calculate totals
  let totalImpressions = 0, totalLikes = 0, totalComments = 0;
  posts.forEach(p => {
    totalImpressions += parseInt(p.impressions) || 0;
    totalLikes += parseInt(p.likes) || 0;
    totalComments += parseInt(p.comments) || 0;
  });

  const payload = `
Total Posts: ${posts.length}
Total Impressions: ${totalImpressions}
Total Likes: ${totalLikes}
Total Comments: ${totalComments}

Posts breakdown:
${posts.map(p => `[${p.platform}] Date: ${new Date(p.published_at).toISOString()} | Likes: ${p.likes} | Comments: ${p.comments} | Hashtags: ${p.hashtags?.join(', ')}`).join('\n')}
`;

  const config = await getSocialConfig();
  const groq = getGroqClient();
  const model = config.model || 'llama-3.3-70b-versatile';

  const systemPrompt = `אתה דאטה-אנליסט מומחה לסושיאל מדיה של KickOff.
המשימה שלך היא לקרוא את הנתונים הגולמיים המצורפים ולהפיק דו"ח תובנות של 3 סעיפים בולטים (Bullet points):
1. Best Time to Post - מגמות של זמנים שהביאו יותר חשיפה.
2. Top Hashtags - אילו האשטגים חזרו בפוסטים המובילים.
3. Engagement Rate & Recommendations - טיפים קצרים לשיפור השבוע הבא.
כתוב הכל בעברית, קצר, מדויק ומקצועי. אל תמציא נתונים - הסתמך רק על מה שסופק!`;

  try {
    const response = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: payload }
      ],
      temperature: 0.3, // Low temperature for analytical accuracy
    });

    const insights = response.choices[0].message.content;

    // Save insight to DB
    await pool.query(
      `INSERT INTO social_knowledge_base (title, content, category) VALUES ($1, $2, $3)`,
      [`דו"ח תובנות שבועי - ${new Date().toLocaleDateString('he-IL')}`, insights, 'general']
    );

    console.log('[AnalyticsAgent] Insights successfully generated and saved to KB.');
    return insights;
  } catch (err) {
    console.error('[AnalyticsAgent] Error generating insights:', err.message);
    return "שגיאה ביצירת התובנות השבועיות.";
  }
}

module.exports = {
  generateAnalyticsInsights
};
