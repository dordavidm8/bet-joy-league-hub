// teamNames.ts – תרגום שמות קבוצות EN↔HE (frontend)
//
// המפה הקנונית נמצאת ב: shared/teamNamesMap.json (מקור אחד לכל הפרויקט).
// loadTeamTranslations() – טוענת תרגומים מאושרים מה-DB פעם אחת בהפעלה (App.tsx).
// translateTeam(name)    – מחזיר שם עברי אם קיים, אחרת השם המקורי.

import TEAM_NAMES_RAW from '../../shared/teamNamesMap.json';

const TEAM_NAMES_HE: Record<string, string> = TEAM_NAMES_RAW;

// Dynamic translations loaded from DB (approved by admin)
let _dynamic: Record<string, string> = {};
export function setDynamicTranslations(map: Record<string, string>) { _dynamic = map; }

// Lookup: static map → dynamic DB map → original
export function translateTeam(name: string): string {
  if (!name) return name;
  if (_dynamic[name]) return _dynamic[name];
  if (TEAM_NAMES_HE[name]) return TEAM_NAMES_HE[name];
  const lower = name.toLowerCase();
  const found = Object.keys(_dynamic).find((k) => k.toLowerCase() === lower)
    ?? Object.keys(TEAM_NAMES_HE).find((k) => k.toLowerCase() === lower);
  if (found) return (_dynamic[found] ?? TEAM_NAMES_HE[found]);
  return name;
}

// Fixed outcome label translations (handles old English DB records)
const OUTCOME_LABELS_HE: Record<string, string> = {
  'Draw': 'תיקו',
  'Yes': 'כן',
  'No': 'לא',
  'Over 2.5': 'מעל 2.5',
  'Under 2.5': 'מתחת 2.5',
};

export function translateOutcomeLabel(label: string): string {
  return OUTCOME_LABELS_HE[label] ?? translateTeam(label);
}

// Translate old English question_text patterns to Hebrew (handles pre-existing DB records)
export function translateQuestionText(text: string): string {
  if (!text) return text;
  // Fix typos that may exist in already-Hebrew DB records
  text = text.replace(/ישכנסו/g, 'יבקיעו');

  // Handle Hebrew question patterns — backend generates these but team names may still be English
  // (e.g. "מי ינצח: Sunderland נגד Burnley?")
  const heWin = text.match(/^מי ינצח:\s*(.+?)\s+נגד\s+(.+?)\?$/);
  if (heWin) return `מי ינצח: ${translateTeam(heWin[1].trim())} נגד ${translateTeam(heWin[2].trim())}?`;

  const heBtts = text.match(/^שתי הקבוצות יבקיעו גול:\s*(.+?)\s+נגד\s+(.+?)\?$/);
  if (heBtts) return `שתי הקבוצות יבקיעו גול: ${translateTeam(heBtts[1].trim())} נגד ${translateTeam(heBtts[2].trim())}?`;

  const heOu = text.match(/^מעל\/מתחת 2\.5 שערים:\s*(.+?)\s+נגד\s+(.+?)\?$/);
  if (heOu) return `מעל/מתחת 2.5 שערים: ${translateTeam(heOu[1].trim())} נגד ${translateTeam(heOu[2].trim())}?`;

  // Already fully Hebrew (not one of our known patterns)
  if (/[֐-׿]/.test(text)) return text;

  // English patterns (old records before Hebrew generation was added)
  const whoWin = text.match(/^Who will win:\s*(.+)\s+vs\s+(.+)\?$/i);
  if (whoWin) return `מי ינצח: ${translateTeam(whoWin[1].trim())} נגד ${translateTeam(whoWin[2].trim())}?`;

  const btts = text.match(/^Both teams to score in\s*(.+)\s+vs\s+(.+)\?$/i);
  if (btts) return `שתי הקבוצות יבקיעו גול: ${translateTeam(btts[1].trim())} נגד ${translateTeam(btts[2].trim())}?`;

  const ou = text.match(/^Over\/Under 2\.5 goals in\s*(.+)\s+vs\s+(.+)\?$/i);
  if (ou) return `מעל/מתחת 2.5 שערים: ${translateTeam(ou[1].trim())} נגד ${translateTeam(ou[2].trim())}?`;

  return text;
}
