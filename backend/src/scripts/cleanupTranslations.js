/**
 * scripts/cleanupTranslations.js – ניקוי תרגומים ממתינים
 *
 * סקריפט תחזוקה חד-פעמי. מוחק תרגומי שמות קבוצות ממצב 'pending'
 * מ-team_name_translations table.
 * הרצה: node backend/src/scripts/cleanupTranslations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../../whatsapp-bot/.env') });
const { pool } = require('../config/database');

async function cleanupTranslations() {
  console.log('--- Starting Translation Cleanup ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const replacements = [
      { old: 'וולברהמפטון', new: 'וולבס' },
      { old: 'באיירן לברקוזן', new: 'באייר לברקוזן' },
      { old: 'אינטר מילאן', new: 'אינטר' }
    ];

    for (const { old, new: newVal } of replacements) {
      console.log(`Replacing "${old}" with "${newVal}"...`);

      // 1. Update bet_questions.question_text
      const qRes = await client.query(
        `UPDATE bet_questions 
         SET question_text = REPLACE(question_text, $1, $2)
         WHERE question_text LIKE $3`,
        [old, newVal, `%${old}%`]
      );
      console.log(`  Updated ${qRes.rowCount} question texts.`);

      // 2. Update bet_questions.outcomes (JSONB)
      // We need to iterate and replace labels in the JSON array
      const outcomesRes = await client.query(
        `SELECT id, outcomes FROM bet_questions WHERE outcomes::text LIKE $1`,
        [`%${old}%`]
      );
      for (const row of outcomesRes.rows) {
        const newOutcomes = row.outcomes.map(o => ({
          ...o,
          label: o.label === old ? newVal : o.label.replace(new RegExp(old, 'g'), newVal)
        }));
        await client.query(
          `UPDATE bet_questions SET outcomes = $1 WHERE id = $2`,
          [JSON.stringify(newOutcomes), row.id]
        );
      }
      console.log(`  Updated ${outcomesRes.rows.length} outcome sets.`);

      // 3. Update existing pending bets (so settlement doesn't fail)
      const betsRes = await client.query(
        `UPDATE bets 
         SET selected_outcome = $1 
         WHERE selected_outcome = $2 AND status = 'pending'`,
        [newVal, old]
      );
      console.log(`  Updated ${betsRes.rowCount} pending bets.`);
    }

    await client.query('COMMIT');
    console.log('--- Cleanup Completed Successfully ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during cleanup:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

cleanupTranslations();
