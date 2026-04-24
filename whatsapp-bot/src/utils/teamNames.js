/**
 * utils/teamNames.js – תרגום שמות קבוצות (WhatsApp bot)
 *
 * המפה הקנונית נמצאת ב: shared/teamNamesMap.json
 * translateTeam(name, approvedDynamic) – מחזיר שם עברי אם קיים, אחרת מקורי.
 * isKnownTeam(name)                   – האם הקבוצה מוכרת במפה הסטטית.
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

module.exports = { translateTeam, isKnownTeam, TEAM_NAMES_HE };
