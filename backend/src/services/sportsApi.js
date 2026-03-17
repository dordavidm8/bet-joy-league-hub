/**
 * API-Football integration (api-football.com)
 * Docs: https://www.api-football.com/documentation-v3
 */

const axios = require('axios');

const client = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: {
    'x-apisports-key': process.env.API_FOOTBALL_KEY,
  },
});

// Fetch live fixtures
async function getLiveFixtures() {
  const res = await client.get('/fixtures', { params: { live: 'all' } });
  return res.data.response;
}

// Fetch fixtures for a specific date (YYYY-MM-DD)
async function getFixturesByDate(date) {
  const res = await client.get('/fixtures', { params: { date } });
  return res.data.response;
}

// Fetch a single fixture by API id
async function getFixtureById(fixtureId) {
  const res = await client.get('/fixtures', { params: { id: fixtureId } });
  return res.data.response[0] || null;
}

// Fetch odds for a fixture (market: match_winner = 1, both_teams_score = 8, etc.)
async function getOdds(fixtureId) {
  const res = await client.get('/odds', {
    params: { fixture: fixtureId, bookmaker: 1 },
  });
  return res.data.response[0] || null;
}

// Fetch top scorers for a league/season
async function getTopScorers(leagueId, season) {
  const res = await client.get('/players/topscorers', {
    params: { league: leagueId, season },
  });
  return res.data.response;
}

// Fetch leagues
async function getLeagues(params = {}) {
  const res = await client.get('/leagues', { params });
  return res.data.response;
}

/**
 * Build bet questions from a fixture's API data + odds
 * Returns array of question objects ready for DB insertion
 */
function buildBetQuestions(fixture, oddsData) {
  const questions = [];

  const home = fixture.teams.home.name;
  const away = fixture.teams.away.name;

  // Always: Match winner (1X2)
  const winnerOdds = extractOdds(oddsData, 'Match Winner');
  questions.push({
    question_type: 'winner',
    question_text: `מי ינצח? ${home} vs ${away}`,
    options: [
      { key: 'home', label: home, odds: winnerOdds?.home || 2.0 },
      { key: 'draw', label: 'תיקו', odds: winnerOdds?.draw || 3.2 },
      { key: 'away', label: away, odds: winnerOdds?.away || 3.5 },
    ],
    is_available_live: true,
    live_lock_minute: 75,
  });

  // Both teams to score
  const bttsOdds = extractOdds(oddsData, 'Both Teams Score');
  if (bttsOdds) {
    questions.push({
      question_type: 'both_teams_score',
      question_text: 'שתי הקבוצות יכניסו שער?',
      options: [
        { key: 'yes', label: 'כן', odds: bttsOdds.yes || 1.75 },
        { key: 'no', label: 'לא', odds: bttsOdds.no || 2.0 },
      ],
      is_available_live: true,
      live_lock_minute: 75,
    });
  }

  // Over/Under 2.5
  const ouOdds = extractOdds(oddsData, 'Goals Over/Under');
  if (ouOdds) {
    questions.push({
      question_type: 'total_goals',
      question_text: 'יותר או פחות מ-2.5 גולים?',
      options: [
        { key: 'over', label: 'יותר מ-2.5', odds: ouOdds.over || 1.85 },
        { key: 'under', label: 'פחות מ-2.5', odds: ouOdds.under || 1.95 },
      ],
      is_available_live: true,
      live_lock_minute: 60, // lock earlier for total goals
    });
  }

  return questions;
}

function extractOdds(oddsData, marketName) {
  if (!oddsData?.bookmakers?.length) return null;
  const bookmaker = oddsData.bookmakers[0];
  const market = bookmaker.bets?.find((b) => b.name === marketName);
  if (!market) return null;

  const result = {};
  for (const val of market.values) {
    const key = val.value.toLowerCase().replace(/[^a-z]/g, '_');
    result[key] = parseFloat(val.odd);
  }
  return result;
}

module.exports = {
  getLiveFixtures,
  getFixturesByDate,
  getFixtureById,
  getOdds,
  getTopScorers,
  getLeagues,
  buildBetQuestions,
};
