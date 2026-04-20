const { pool } = require('../config/database');
const { fetchAllOdds } = require('./oddsApi');
const { fetchAllGames } = require('./sportsApi');

// Hebrew → English team name (inverse of translateTeam)
const { TEAM_NAMES_HE } = require('../lib/teamNames');
const _heToEn = Object.fromEntries(Object.entries(TEAM_NAMES_HE).map(([en, he]) => [he, en]));

function normalizeTeam(name) {
  if (!name) return name;
  // Already English
  if (_heToEn[name]) return _heToEn[name];
  // Strip accents
  const stripped = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const found = Object.keys(TEAM_NAMES_HE).find(k => k.toLowerCase() === stripped);
  return found || name;
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function get_team_form({ team, limit = 5 }) {
  const teamEn = normalizeTeam(team);
  const res = await pool.query(
    `SELECT home_team, away_team, score_home, score_away, start_time, status
     FROM games
     WHERE (home_team ILIKE $1 OR away_team ILIKE $1)
       AND status = 'finished'
     ORDER BY start_time DESC
     LIMIT $2`,
    [`%${teamEn}%`, limit]
  );
  const rows = res.rows;
  if (!rows.length) return { markdown: `אין נתוני היסטוריה עבור ${team}`, rows: 0 };

  const lines = rows.map(r => {
    const isHome = r.home_team.toLowerCase().includes(teamEn.toLowerCase());
    const result = isHome
      ? (r.score_home > r.score_away ? 'W' : r.score_home < r.score_away ? 'L' : 'D')
      : (r.score_away > r.score_home ? 'W' : r.score_away < r.score_home ? 'L' : 'D');
    const date = new Date(r.start_time).toISOString().slice(0, 10);
    return `${date} | ${r.home_team} ${r.score_home}-${r.score_away} ${r.away_team} | ${result}`;
  });
  return { markdown: lines.join('\n'), rows: lines.length, source: 'DB' };
}

async function get_head_to_head({ team1, team2, limit = 5 }) {
  const t1 = normalizeTeam(team1);
  const t2 = normalizeTeam(team2);
  const res = await pool.query(
    `SELECT home_team, away_team, score_home, score_away, start_time
     FROM games
     WHERE ((home_team ILIKE $1 AND away_team ILIKE $2)
        OR  (home_team ILIKE $2 AND away_team ILIKE $1))
       AND status = 'finished'
     ORDER BY start_time DESC
     LIMIT $3`,
    [`%${t1}%`, `%${t2}%`, limit]
  );
  if (!res.rows.length) return { markdown: `אין היסטוריית מפגשים בין ${team1} ל-${team2}`, rows: 0 };
  const lines = res.rows.map(r => {
    const date = new Date(r.start_time).toISOString().slice(0, 10);
    return `${date} | ${r.home_team} ${r.score_home}-${r.score_away} ${r.away_team}`;
  });
  return { markdown: lines.join('\n'), rows: lines.length, source: 'DB' };
}

async function get_upcoming_games({ team }) {
  const teamEn = normalizeTeam(team);
  const res = await pool.query(
    `SELECT home_team, away_team, start_time, status
     FROM games
     WHERE (home_team ILIKE $1 OR away_team ILIKE $1)
       AND status IN ('scheduled','live')
       AND start_time >= NOW()
     ORDER BY start_time ASC
     LIMIT 5`,
    [`%${teamEn}%`]
  );
  if (!res.rows.length) return { markdown: `אין משחקים קרובים עבור ${team}`, rows: 0 };
  const lines = res.rows.map(r => {
    const date = new Date(r.start_time).toISOString().slice(0, 16).replace('T', ' ');
    return `${date} | ${r.home_team} vs ${r.away_team} [${r.status}]`;
  });
  return { markdown: lines.join('\n'), rows: lines.length, source: 'DB' };
}

async function get_match_odds({ team1, team2 }) {
  const t1 = normalizeTeam(team1);
  const t2 = normalizeTeam(team2);
  const odds = await fetchAllOdds();
  const key = Object.keys(odds).find(k => {
    const [h, a] = k.split('|');
    return (h.toLowerCase().includes(t1.toLowerCase()) && a.toLowerCase().includes(t2.toLowerCase()))
        || (h.toLowerCase().includes(t2.toLowerCase()) && a.toLowerCase().includes(t1.toLowerCase()));
  });
  if (!key) return { markdown: `אין נתוני הימור זמינים עבור ${team1} נגד ${team2}`, rows: 0 };
  const o = odds[key];
  const [h, a] = key.split('|');
  const lines = [
    `${h} (ביתי): ${o.home_odds ?? '-'}`,
    `תיקו: ${o.draw_odds ?? '-'}`,
    `${a} (אורח): ${o.away_odds ?? '-'}`,
    o.btts_yes ? `שתי הקבוצות יבקיעו (כן): ${o.btts_yes} | (לא): ${o.btts_no}` : null,
    o.over_2_5 ? `מעל 2.5 שערים: ${o.over_2_5} | מתחת: ${o.under_2_5}` : null,
  ].filter(Boolean);
  return { markdown: lines.join('\n'), rows: lines.length, source: 'The Odds API' };
}

async function get_live_stats({ team }) {
  const teamEn = normalizeTeam(team);
  const res = await pool.query(
    `SELECT home_team, away_team, score_home, score_away, minute, status
     FROM games
     WHERE (home_team ILIKE $1 OR away_team ILIKE $1)
       AND status = 'live'
     LIMIT 1`,
    [`%${teamEn}%`]
  );
  if (!res.rows.length) return { markdown: `${team} לא משחקת כרגע`, rows: 0 };
  const r = res.rows[0];
  return {
    markdown: `${r.home_team} ${r.score_home}-${r.score_away} ${r.away_team} | דקה: ${r.minute ?? '?'}`,
    rows: 1,
    source: 'DB live',
  };
}

// ── Tool schemas (Groq tool_choice format) ───────────────────────────────────

const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'get_team_form',
      description: 'Returns last N finished games for a team (result W/L/D, score, date). Use for recent form analysis.',
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: "Team name in English or Hebrew, e.g. 'Arsenal' or 'ארסנל'" },
          limit: { type: 'integer', default: 5 },
        },
        required: ['team'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_head_to_head',
      description: 'Head-to-head results between two teams. Use when user asks about past matchups.',
      parameters: {
        type: 'object',
        properties: {
          team1: { type: 'string' },
          team2: { type: 'string' },
          limit: { type: 'integer', default: 5 },
        },
        required: ['team1', 'team2'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_games',
      description: 'Upcoming or live scheduled games for a team.',
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string' },
        },
        required: ['team'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_match_odds',
      description: 'Betting odds (1X2, BTTS, over/under 2.5) for a match. Use when user asks about odds or value.',
      parameters: {
        type: 'object',
        properties: {
          team1: { type: 'string' },
          team2: { type: 'string' },
        },
        required: ['team1', 'team2'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_live_stats',
      description: 'Live score and minute for a team currently playing.',
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string' },
        },
        required: ['team'],
      },
    },
  },
];

const TOOL_FN_MAP = {
  get_team_form,
  get_head_to_head,
  get_upcoming_games,
  get_match_odds,
  get_live_stats,
};

module.exports = { TOOL_SCHEMAS, TOOL_FN_MAP, normalizeTeam };
