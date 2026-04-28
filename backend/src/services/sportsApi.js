/**
 * sportsApi.js – אינטגרציה עם ESPN API ו-The Odds API
 *
 * fetchAllGames()        – מביא כל המשחקים מ-ESPN (7 ליגות מרכזיות)
 * fetchScoreboard(slug)  – מביא משחקים לליגה ספציפית
 * buildBetQuestions(game)– בונה 3-4 שאלות הימור לכל משחק:
 *                          match_winner, btts, over_under, exact_score
 * getOdds(home, away)    – מביא odds מ-The Odds API (cache 5 דקות)
 *
 * המרת odds: American → Decimal
 * תרגום שמות קבוצות: EN → HE דרך teamNames.js
 */
const axios = require('axios');
const { translateTeam } = require('../lib/teamNames');

function americanToDecimal(american) {
  const val = parseInt(american);
  if (isNaN(val)) return null;
  if (val > 0) return parseFloat((1 + val / 100).toFixed(2));
  return parseFloat((1 + 100 / Math.abs(val)).toFixed(2));
}

// Strip accents for fuzzy name matching (e.g. "Atlético" → "atletico")
function normalizeName(name) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

let _oddsCacheHe = {}; // Hebrew key mapping
let _oddsCacheFuzzy = {}; // super-fuzzy stripped keys

function stripSuffixes(name) {
  return normalizeName(name)
    .replace(/\b(fc|sv|ac|as|us|cf|cd|ud|rcd|rc|sc|afc|bsc|cfc|fsv|vfl|vfb|tsg|us|1\. fc|1\.|05|98|1846|1907|calcio|foot|olympique|de|stade|utd|united|city|hotspur|cp)\b/g, '')
    .trim();
}

function setOddsCache(cache, dbTranslations = {}) {
  _oddsCache = cache;
  _oddsCacheNorm = {};
  _oddsCacheHe = {};
  _oddsCacheFuzzy = {};

  for (const [key, val] of Object.entries(cache)) {
    const pipe = key.indexOf('|');
    if (pipe === -1) continue;
    const hEn = key.slice(0, pipe);
    const aEn = key.slice(pipe + 1);
    
    _oddsCacheNorm[`${normalizeName(hEn)}|${normalizeName(aEn)}`] = val;
    _oddsCacheFuzzy[`${stripSuffixes(hEn)}|${stripSuffixes(aEn)}`] = val;
    
    const hHe = translateTeam(hEn, dbTranslations);
    const aHe = translateTeam(aEn, dbTranslations);
    if (hHe && aHe) {
      _oddsCacheHe[`${hHe}|${aHe}`] = val;
    }
  }
}

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Map common competition slugs to ESPN league paths
const LEAGUE_SLUGS = {
  'eng.1':        'eng.1',        // Premier League
  'esp.1':        'esp.1',        // La Liga
  'ger.1':        'ger.1',        // Bundesliga
  'ita.1':        'ita.1',        // Serie A
  'fra.1':        'fra.1',        // Ligue 1
  'uefa.champions': 'uefa.champions',
  'fifa.world':   'fifa.world',   // FIFA World Cup 2026
  // isr.1 removed — ESPN data for Israeli league is unreliable
};

// ESPN team abbreviation → flagcdn.com ISO2 code (for national teams)
const NATIONAL_TEAM_FLAGS = {
  ALG: 'dz', ARG: 'ar', AUS: 'au', AUT: 'at', BEL: 'be',
  BIH: 'ba', BRA: 'br', CAN: 'ca', CIV: 'ci', COD: 'cd',
  COL: 'co', CPV: 'cv', CRO: 'hr', CUR: 'cw', CZE: 'cz',
  ECU: 'ec', EGY: 'eg', ENG: 'gb-eng', ESP: 'es', FRA: 'fr',
  GER: 'de', GHA: 'gh', HAI: 'ht', IRN: 'ir', IRQ: 'iq',
  JOR: 'jo', JPN: 'jp', KOR: 'kr', KSA: 'sa', MAR: 'ma',
  MEX: 'mx', NED: 'nl', NOR: 'no', NZL: 'nz', PAN: 'pa',
  PAR: 'py', POR: 'pt', QAT: 'qa', RSA: 'za', SCO: 'gb-sct',
  SEN: 'sn', SUI: 'ch', SWE: 'se', TUN: 'tn', TUR: 'tr',
  URU: 'uy', USA: 'us', UZB: 'uz',
};

function flagUrl(abbrev) {
  const iso = NATIONAL_TEAM_FLAGS[abbrev?.toUpperCase()];
  return iso ? `https://flagcdn.com/w80/${iso}.png` : null;
}

const DEFAULT_LEAGUES = Object.values(LEAGUE_SLUGS);

// ── Fetch scoreboard for a league (last 7 days + next 30 days) ───────────────
async function fetchScoreboard(leagueSlug) {
  const now = new Date();
  const past   = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const pastStr = past.toISOString().slice(0, 10).replace(/-/g, '');
  const fromStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const toStr   = future.toISOString().slice(0, 10).replace(/-/g, '');

  // Fetch current round, past 7 days (to update finished status), and upcoming 30 days
  const [current, recent, upcoming] = await Promise.allSettled([
    axios.get(`${ESPN_BASE}/${leagueSlug}/scoreboard`, { timeout: 10000 }),
    axios.get(`${ESPN_BASE}/${leagueSlug}/scoreboard?dates=${pastStr}-${fromStr}&limit=100`, { timeout: 10000 }),
    axios.get(`${ESPN_BASE}/${leagueSlug}/scoreboard?dates=${fromStr}-${toStr}&limit=100`, { timeout: 10000 }),
  ]);

  // Merge and deduplicate by event id
  const seen = new Set();
  const events = [];
  for (const r of [current, recent, upcoming]) {
    if (r.status === 'rejected') continue;
    for (const e of (r.value.data.events || [])) {
      if (!seen.has(e.id)) { seen.add(e.id); events.push(e); }
    }
  }
  return events;
}

// ── Map ESPN event → our DB shape ─────────────────────────────────────────────
function mapEvent(event, leagueSlug) {
  const comp   = event.competitions?.[0];
  const status = event.status;
  const home   = comp?.competitors?.find(c => c.homeAway === 'home');
  const away   = comp?.competitors?.find(c => c.homeAway === 'away');
  if (!home || !away) return null;

  const espnStatus = status?.type?.name;
  const isCompleted = status?.type?.completed || espnStatus === 'STATUS_FINAL' || espnStatus === 'STATUS_FULL_TIME';
  const isPostponed = espnStatus === 'STATUS_POSTPONED' || espnStatus === 'STATUS_CANCELED' || espnStatus === 'STATUS_SUSPENDED';

  let gameStatus = 'scheduled';
  if (espnStatus && (espnStatus.includes('IN_PROGRESS') || espnStatus.includes('LIVE'))) {
    gameStatus = 'live';
  } else if (isCompleted) {
    gameStatus = 'finished';
  } else if (isPostponed) {
    gameStatus = 'postponed';
  }

  const minute = gameStatus === 'live'
    ? parseInt(status?.displayClock) || null
    : null;

  const mapped = {
    espn_id:        event.id,
    competition_slug: leagueSlug,
    home_team:      home.team.displayName,
    away_team:      away.team.displayName,
    home_team_logo: (leagueSlug === 'fifa.world' ? flagUrl(home.team.abbreviation) : null) || home.team.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${home.team.id}.png`,
    away_team_logo: (leagueSlug === 'fifa.world' ? flagUrl(away.team.abbreviation) : null) || away.team.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${away.team.id}.png`,
    start_time:     new Date(event.date),
    status:         gameStatus,
    minute:         minute,
    score_home:     home.score !== undefined && home.score !== '' ? parseInt(home.score) : null,
    score_away:     away.score !== undefined && away.score !== '' ? parseInt(away.score) : null,
    venue:          comp?.venue?.fullName || null,
    espn_odds:      null
  };

  const oddsObj = comp?.odds?.[0];
  if (oddsObj && oddsObj.moneyline) {
    const h = americanToDecimal(oddsObj.moneyline.home?.close?.odds || oddsObj.moneyline.home?.open?.odds);
    const a = americanToDecimal(oddsObj.moneyline.away?.close?.odds || oddsObj.moneyline.away?.open?.odds);
    const d = americanToDecimal(oddsObj.moneyline.draw?.close?.odds || oddsObj.moneyline.draw?.open?.odds);
    if (h && a && d) {
      mapped.espn_odds = { home_odds: h, away_odds: a, draw_odds: d };
    }
  }
  return mapped;
}

// ── Get all upcoming + live games across default leagues ─────────────────────
async function fetchAllGames() {
  const results = await Promise.allSettled(
    DEFAULT_LEAGUES.map(slug => fetchScoreboard(slug))
  );

  const games = [];
  results.forEach((res, i) => {
    if (res.status === 'rejected') {
      console.warn(`[sportsApi] Failed to fetch ${DEFAULT_LEAGUES[i]}:`, res.reason?.message);
      return;
    }
    res.value.forEach(event => {
      const mapped = mapEvent(event, DEFAULT_LEAGUES[i]);
      if (mapped) games.push(mapped);
    });
  });
  return games;
}

// ── Fetch single game by ESPN ID ──────────────────────────────────────────────
async function fetchGameById(leagueSlug, espnId) {
  const url = `${ESPN_BASE}/${leagueSlug}/summary?event=${espnId}`;
  const { data } = await axios.get(url, { timeout: 10000 });
  return data;
}

// ── Build bet questions for a game ────────────────────────────────────────────
// Returns array of { question_text, outcomes: [{label, odds}], type }
function buildBetQuestions(game, dbTranslations = {}) {
  const hEn = game.home_team;
  const aEn = game.away_team;
  const h = translateTeam(hEn, dbTranslations);
  const a = translateTeam(aEn, dbTranslations);

  // Priority: 1. ESPN live odds, 2. The Odds API cache, 3. Defaults
  // Use English names for cache lookup. Normalized fallback handles accent mismatches
  // (e.g. ESPN "Atlético Madrid" vs Odds API "Atletico Madrid")
  const espnOdds  = game.espn_odds || null;
  const hNorm = normalizeName(hEn);
  const aNorm = normalizeName(aEn);
  const apiOdds   = _oddsCache[`${hEn}|${aEn}`]
    || _oddsCache[`${aEn}|${hEn}`]
    || _oddsCacheNorm[`${hNorm}|${aNorm}`]
    || _oddsCacheNorm[`${aNorm}|${hNorm}`]
    || _oddsCacheHe[`${h}|${a}`]
    || _oddsCacheHe[`${a}|${h}`]
    || _oddsCacheFuzzy[`${stripSuffixes(hEn)}|${stripSuffixes(aEn)}`]
    || _oddsCacheFuzzy[`${stripSuffixes(aEn)}|${stripSuffixes(hEn)}`]
    || null;
  const realOdds  = espnOdds || apiOdds;

  const homeOdds  = realOdds?.home_odds  ?? 2.10;
  const drawOdds  = realOdds?.draw_odds  ?? 3.20;
  const awayOdds  = realOdds?.away_odds  ?? 2.80;

  // BTTS & totals come only from The Odds API (ESPN doesn't provide them)
  const bttsYes   = apiOdds?.btts_yes  ?? 1.75;
  const bttsNo    = apiOdds?.btts_no   ?? 1.95;
  const over25    = apiOdds?.over_2_5  ?? 1.85;
  const under25   = apiOdds?.under_2_5 ?? 1.90;

  const winnerSource = espnOdds ? 'espn' : (apiOdds ? 'api' : 'default');
  const otherSource  = apiOdds  ? 'api'  : 'default';

  return [
    {
      type: 'match_winner',
      question_text: `מי ינצח: ${h} נגד ${a}?`,
      odds_source: winnerSource,
      outcomes: [
        { label: h,       odds: homeOdds },
        { label: 'תיקו',  odds: drawOdds },
        { label: a,       odds: awayOdds },
      ],
    },
    {
      type: 'both_teams_score',
      question_text: `שתי הקבוצות יבקיעו גול: ${h} נגד ${a}?`,
      odds_source: otherSource,
      outcomes: [
        { label: 'כן', odds: bttsYes },
        { label: 'לא', odds: bttsNo  },
      ],
    },
    {
      type: 'over_under',
      question_text: `מעל/מתחת 2.5 שערים: ${h} נגד ${a}?`,
      odds_source: otherSource,
      outcomes: [
        { label: 'מעל 2.5',  odds: over25  },
        { label: 'מתחת 2.5', odds: under25 },
      ],
    },
  ];
}

module.exports = { fetchAllGames, fetchGameById, buildBetQuestions, mapEvent, DEFAULT_LEAGUES, setOddsCache };
