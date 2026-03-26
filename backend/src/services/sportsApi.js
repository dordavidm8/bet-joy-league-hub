const axios = require('axios');

function americanToDecimal(american) {
  const val = parseInt(american);
  if (isNaN(val)) return null;
  if (val > 0) return parseFloat((1 + val / 100).toFixed(2));
  return parseFloat((1 + 100 / Math.abs(val)).toFixed(2));
}

let _oddsCache = {}; // { 'HomeTeam|AwayTeam': { home_odds, draw_odds, away_odds } }
function setOddsCache(cache) { _oddsCache = cache; }

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Map common competition slugs to ESPN league paths
const LEAGUE_SLUGS = {
  'eng.1':   'eng.1',   // Premier League
  'esp.1':   'esp.1',   // La Liga
  'ger.1':   'ger.1',   // Bundesliga
  'ita.1':   'ita.1',   // Serie A
  'fra.1':   'fra.1',   // Ligue 1
  'uefa.champions': 'uefa.champions',
  // isr.1 removed — ESPN data for Israeli league is unreliable
};

const DEFAULT_LEAGUES = Object.values(LEAGUE_SLUGS);

// ── Fetch scoreboard for a league (last 7 days + next 30 days) ───────────────
async function fetchScoreboard(leagueSlug) {
  const now = new Date();
  const past   = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
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
  
  let gameStatus = 'scheduled';
  if (espnStatus && (espnStatus.includes('IN_PROGRESS') || espnStatus.includes('LIVE'))) {
    gameStatus = 'live';
  } else if (isCompleted) {
    gameStatus = 'finished';
  }

  const minute = gameStatus === 'live'
    ? parseInt(status?.displayClock) || null
    : null;

  const mapped = {
    espn_id:        event.id,
    competition_slug: leagueSlug,
    home_team:      home.team.displayName,
    away_team:      away.team.displayName,
    home_team_logo: home.team.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${home.team.id}.png`,
    away_team_logo: away.team.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${away.team.id}.png`,
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
function buildBetQuestions(game) {
  const h = game.home_team;
  const a = game.away_team;

  // Priority: 1. ESPN live odds, 2. The Odds API cache, 3. Defaults
  const realOdds = game.espn_odds || _oddsCache[`${h}|${a}`] || _oddsCache[`${a}|${h}`];
  const homeOdds = realOdds?.home_odds ?? 2.10;
  const drawOdds = realOdds?.draw_odds ?? 3.20;
  const awayOdds = realOdds?.away_odds ?? 2.80;

  return [
    {
      type: 'match_winner',
      question_text: `Who will win: ${h} vs ${a}?`,
      outcomes: [
        { label: h,      odds: homeOdds },
        { label: 'Draw', odds: drawOdds },
        { label: a,      odds: awayOdds },
      ],
    },
    {
      type: 'both_teams_score',
      question_text: `Both teams to score in ${h} vs ${a}?`,
      outcomes: [
        { label: 'Yes', odds: 1.75 },
        { label: 'No',  odds: 1.95 },
      ],
    },
    {
      type: 'over_under',
      question_text: `Over/Under 2.5 goals in ${h} vs ${a}?`,
      outcomes: [
        { label: 'Over 2.5',  odds: 1.85 },
        { label: 'Under 2.5', odds: 1.90 },
      ],
    },
  ];
}

module.exports = { fetchAllGames, fetchGameById, buildBetQuestions, mapEvent, DEFAULT_LEAGUES, setOddsCache };
