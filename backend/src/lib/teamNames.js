/**
 * teamNames.js – תרגום שמות קבוצות (backend)
 *
 * המפה הקנונית נמצאת ב: shared/teamNamesMap.json
 * קובץ זה מוסיף לוגיקת backend:
 *   translateTeam(name, approvedDynamic) – תרגום עם fallback לתרגומים מה-DB
 *   isKnownTeam(name)                   – האם הקבוצה מוכרת במפה הסטטית
 *   llmTranslateTeam(nameEn)            – תרגום דרך Groq LLM לקבוצות חדשות
 *   queueUnknownTeams(pool, names)      – שומר קבוצות לא-מוכרות ב-DB + מתרגם async
 */
const TEAM_NAMES_HE = require('../../../shared/teamNamesMap.json');

function translateTeam(name, approvedDynamic = {}) {
  if (!name) return name;
  if (approvedDynamic[name]) return approvedDynamic[name];
  if (TEAM_NAMES_HE[name]) return TEAM_NAMES_HE[name];
  const lower = name.toLowerCase();
  const found = Object.keys(approvedDynamic).find((k) => k.toLowerCase() === lower)
    ?? Object.keys(TEAM_NAMES_HE).find((k) => k.toLowerCase() === lower);
  if (found) return approvedDynamic[found] ?? TEAM_NAMES_HE[found];
  return name;
}

function isKnownTeam(name) {
  if (!name) return true;
  if (TEAM_NAMES_HE[name]) return true;
  const lower = name.toLowerCase();
  return Object.keys(TEAM_NAMES_HE).some((k) => k.toLowerCase() === lower);
}

// Ask Groq for a Hebrew translation of an unknown English team name
async function llmTranslateTeam(nameEn) {
  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const resp = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      max_tokens: 30,
      messages: [
        {
          role: 'system',
          content: 'אתה מומחה כדורגל ישראלי. תרגם שם קבוצה/נבחרת מאנגלית לעברית כפי שמשתמשים בה בישראל. החזר רק את השם בעברית, ללא כל טקסט נוסף.',
        },
        { role: 'user', content: nameEn },
      ],
    });
    return resp.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[teamNames] Groq translation failed for', nameEn, err.message);
    return null;
  }
}

// Queue unknown team names: insert to DB as pending + call LLM (fire-and-forget)
async function queueUnknownTeams(pool, names) {
  const unknown = names.filter((n) => n && !isKnownTeam(n));
  if (!unknown.length) return;

  for (const nameEn of unknown) {
    try {
      const existing = await pool.query(
        `SELECT name_en FROM team_name_translations WHERE name_en = $1`, [nameEn]
      );
      if (existing.rows.length > 0) continue;

      // Save as pending immediately (without waiting for LLM)
      await pool.query(
        `INSERT INTO team_name_translations (name_en, name_he, status) VALUES ($1, NULL, 'pending') ON CONFLICT DO NOTHING`,
        [nameEn]
      );

      // Translate via Groq async (don't await)
      llmTranslateTeam(nameEn).then(async (nameHe) => {
        if (!nameHe) return;
        await pool.query(
          `UPDATE team_name_translations SET name_he = $1 WHERE name_en = $2`,
          [nameHe, nameEn]
        );
        console.log(`[teamNames] LLM translated "${nameEn}" → "${nameHe}"`);
      }).catch(() => {});
    } catch (err) {
      console.error('[teamNames] queueUnknownTeams error:', err.message);
    }
  }
}

module.exports = { translateTeam, isKnownTeam, queueUnknownTeams, TEAM_NAMES_HE };
