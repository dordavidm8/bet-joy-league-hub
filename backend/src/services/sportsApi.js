/**
 * ESPN Unofficial API integration
 * Base URL: http://site.api.espn.com/apis/site/v2/sports/soccer
 */

const axios = require('axios');

const baseURL = 'http://site.api.espn.com/apis/site/v2/sports/soccer';

// Map of supported leagues (ESPN slugs)
const SUPPORTED_LEAGUES = [
  { slug: 'eng.1', name: 'Premier League' },
  { slug: 'esp.1', name: 'LaLiga' },
  { slug: 'ger.1', name: 'Bundesliga' },
  { slug: 'ita.1', name: 'Serie A' },
  { slug: 'fra.1', name: 'Ligue 1' },
  { slug: 'uefa.champions', name: 'Champions League' },
  { slug: 'isr.1', name: 'Ligat HaAl' }
];

/**
 * Fetch scoreboard for a specific league
 * ESPN uses /scoreboard as the main endpoint for scores and odds
 */
async function getScoreboard(leagueSlug, date = null) {
  const url = `${baseURL}/${leagueSlug}/scoreboard`;
  const params = date ? { dates: date.replace(/-/g, '') } : {};
  const res = await axios.get(url, { params });
  return res.data;
}

/**
 * Fetch all fixtures for all supported leagues for a specific date
 */
async function getAllFixturesByDate(date) {
  let allFixtures = [];
  for (const league of SUPPORTED_LEAGUES) {
    try {
      const data = await getScoreboard(league.slug, date);
      if (data.events) {
        // Tag each event with the league info
        const events = data.events.map(event => ({
          ...event,
          leagueInfo: data.leagues?.[0] || { id: league.slug, name: league.name }
        }));
        allFixtures = [...allFixtures, ...events];
      }
    } catch (err) {
      console.error(`[ESPN API] Error fetching ${league.slug}:`, err.message);
    }
  }
  return allFixtures;
}

/**
 * Build bet questions from ESPN event data
 * ESPN includes odds in competition.odds
 */
function buildBetQuestions(event) {
  const questions = [];
  const competition = event.competitions[0];
  const oddsData = competition.odds?.[0]; // Usually DraftKings or similar

  const home = competition.competitors.find(c => c.homeAway === 'home');
  const away = competition.competitors.find(c => c.homeAway === 'away');

  const homeName = home.team.displayName;
  const awayName = away.team.displayName;

  // 1. Match Winner (Moneyline)
  if (oddsData?.moneyline) {
    questions.push({
      question_type: 'winner',
      question_text: `מי ינצח? ${homeName} vs ${awayName}`,
      options: [
        { key: 'home', label: homeName, odds: convertMoneyline(oddsData.moneyline.home?.close?.odds) || 2.0 },
        { key: 'draw', label: 'תיקו', odds: convertMoneyline(oddsData.moneyline.draw?.close?.odds) || 3.2 },
        { key: 'away', label: awayName, odds: convertMoneyline(oddsData.moneyline.away?.close?.odds) || 3.5 },
      ],
      is_available_live: true,
      live_lock_minute: 75,
    });
  } else {
    // Default odds if not available
    questions.push({
      question_type: 'winner',
      question_text: `מי ינצח? ${homeName} vs ${awayName}`,
      options: [
        { key: 'home', label: homeName, odds: 2.0 },
        { key: 'draw', label: 'תיקו', odds: 3.2 },
        { key: 'away', label: awayName, odds: 3.5 },
      ],
      is_available_live: true,
      live_lock_minute: 75,
    });
  }

  // 2. Over/Under Total Goals
  if (oddsData?.total) {
    const line = oddsData.overUnder || 2.5;
    questions.push({
      question_type: 'total_goals',
      question_text: `יותר או פחות מ-${line} גולים?`,
      options: [
        { key: 'over', label: `יותר מ-${line}`, odds: convertMoneyline(oddsData.total.over?.close?.odds) || 1.85 },
        { key: 'under', label: `פחות מ-${line}`, odds: convertMoneyline(oddsData.total.under?.close?.odds) || 1.95 },
      ],
      is_available_live: true,
      live_lock_minute: 60,
    });
  }

  return questions;
}

/**
 * Convert American Moneyline (e.g. +115, -150) to Decimal Odds
 * Formula for positive: (ML / 100) + 1
 * Formula for negative: (100 / |ML|) + 1
 */
function convertMoneyline(ml) {
  if (!ml) return null;
  if (typeof ml === 'string' && ml.toLowerCase() === 'even') return 2.0;

  const val = parseInt(ml);
  if (isNaN(val)) return null;

  if (val > 0) return parseFloat(((val / 100) + 1).toFixed(2));
  return parseFloat(((100 / Math.abs(val)) + 1).toFixed(2));
}

module.exports = {
  SUPPORTED_LEAGUES,
  getScoreboard,
  getAllFixturesByDate,
  buildBetQuestions,
};
