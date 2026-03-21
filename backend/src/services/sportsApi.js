const axios = require('axios');

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

// ── Fetch scoreboard for a league (today + next 30 days) ─────────────────────
async function fetchScoreboard(leagueSlug) {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fromStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const toStr   = future.toISOString().slice(0, 10).replace(/-/g, '');

  // Fetch current round AND upcoming 30 days in parallel
  const [current, upcoming] = await Promise.allSettled([
    axios.get(`${ESPN_BASE}/${leagueSlug}/scoreboard`, { timeout: 10000 }),
    axios.get(`${ESPN_BASE}/${leagueSlug}/scoreboard?dates=${fromStr}-${toStr}&limit=100`, { timeout: 10000 }),
  ]);

  // Merge and deduplicate by event id
  const seen = new Set();
  const events = [];
  for (const r of [current, upcoming]) {
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

  const espnStatus = status?.type?.name; // 'STATUS_SCHEDULED' | 'STATUS_IN_PROGRESS' | 'STATUS_FINAL'
  let gameStatus = 'scheduled';
  if (espnStatus === 'STATUS_IN_PROGRESS') gameStatus = 'live';
  else if (espnStatus === 'STATUS_FINAL')  gameStatus = 'finished';

  const minute = espnStatus === 'STATUS_IN_PROGRESS'
    ? parseInt(status?.displayClock) || null
    : null;

  return {
    espn_id:        event.id,
    competition_slug: leagueSlug,
    home_team:      home.team.displayName,
    away_team:      away.team.displayName,
    home_team_logo: home.team.logo || null,
    away_team_logo: away.team.logo || null,
    start_time:     new Date(event.date),
    status:         gameStatus,
    minute:         minute,
    score_home:     home.score !== undefined && home.score !== '' ? parseInt(home.score) : null,
    score_away:     away.score !== undefined && away.score !== '' ? parseInt(away.score) : null,
    venue:          comp?.venue?.fullName || null,
  };
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

  // Try to use real odds from The Odds API cache, fall back to defaults
  const realOdds = _oddsCache[`${h}|${a}`] || _oddsCache[`${a}|${h}`];
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
