const axios = require('axios');

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Map common competition slugs to ESPN league paths
const LEAGUE_SLUGS = {
  'eng.1':   'eng.1',   // Premier League
  'esp.1':   'esp.1',   // La Liga
  'ger.1':   'ger.1',   // Bundesliga
  'ita.1':   'ita.1',   // Serie A
  'fra.1':   'fra.1',   // Ligue 1
  'uefa.champions': 'uefa.champions',
  'isr.1':   'isr.1',   // Israeli Premier League
};

const DEFAULT_LEAGUES = Object.values(LEAGUE_SLUGS);

// ── Fetch scoreboard for a league (today + next 7 days) ───────────────────────
async function fetchScoreboard(leagueSlug) {
  const url = `${ESPN_BASE}/${leagueSlug}/scoreboard`;
  const { data } = await axios.get(url, { timeout: 10000 });
  return data.events || [];
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
    score_home:     parseInt(home.score) || 0,
    score_away:     parseInt(away.score) || 0,
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

  const questions = [
    {
      type:          'match_winner',
      question_text: `Who will win: ${h} vs ${a}?`,
      outcomes: [
        { label: h,      odds: 2.1 },
        { label: 'Draw', odds: 3.2 },
        { label: a,      odds: 2.8 },
      ],
    },
    {
      type:          'both_teams_score',
      question_text: `Both teams to score in ${h} vs ${a}?`,
      outcomes: [
        { label: 'Yes', odds: 1.75 },
        { label: 'No',  odds: 1.95 },
      ],
    },
    {
      type:          'over_under',
      question_text: `Over/Under 2.5 goals in ${h} vs ${a}?`,
      outcomes: [
        { label: 'Over 2.5',  odds: 1.85 },
        { label: 'Under 2.5', odds: 1.90 },
      ],
    },
  ];
  return questions;
}

module.exports = { fetchAllGames, fetchGameById, buildBetQuestions, mapEvent, DEFAULT_LEAGUES };
