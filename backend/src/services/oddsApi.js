// The Odds API integration — https://the-odds-api.com
// Set THE_ODDS_API_KEY in Railway env vars to enable real odds
const axios = require('axios');

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const API_KEY = process.env.THE_ODDS_API_KEY;

// ESPN league slug → The Odds API sport key
const SPORT_MAP = {
  'eng.1':          'soccer_epl',
  'esp.1':          'soccer_spain_la_liga',
  'ger.1':          'soccer_germany_bundesliga',
  'ita.1':          'soccer_italy_serie_a',
  'fra.1':          'soccer_france_ligue_one',
  'uefa.champions': 'soccer_uefa_champs_league',
};

// Fetch odds for a sport, returns map: `${homeTeam}|${awayTeam}` → { h2h: [homeOdds, drawOdds, awayOdds] }
async function fetchOddsForSport(sportKey) {
  if (!API_KEY) return {};
  try {
    const { data } = await axios.get(`${ODDS_API_BASE}/sports/${sportKey}/odds`, {
      params: { apiKey: API_KEY, regions: 'eu', markets: 'h2h', oddsFormat: 'decimal' },
      timeout: 10000,
    });
    const map = {};
    for (const event of data) {
      const bookie = event.bookmakers?.[0];
      if (!bookie) continue;
      const market = bookie.markets?.find(m => m.key === 'h2h');
      if (!market) continue;
      const home = market.outcomes?.find(o => o.name === event.home_team);
      const away = market.outcomes?.find(o => o.name === event.away_team);
      const draw = market.outcomes?.find(o => o.name === 'Draw');
      if (!home || !away) continue;
      const key = `${event.home_team}|${event.away_team}`;
      map[key] = {
        home_odds: parseFloat(home.price.toFixed(2)),
        draw_odds: draw ? parseFloat(draw.price.toFixed(2)) : 3.2,
        away_odds: parseFloat(away.price.toFixed(2)),
      };
    }
    return map;
  } catch (err) {
    console.warn(`[oddsApi] Failed to fetch ${sportKey}:`, err.message);
    return {};
  }
}

// Cache odds for 12 hours to stay within free-tier request limits (500/month)
let _oddsCache = { data: {}, fetchedAt: 0 };
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// Fetch all odds across all supported sports (cached)
async function fetchAllOdds() {
  if (Date.now() - _oddsCache.fetchedAt < CACHE_TTL_MS) {
    return _oddsCache.data;
  }
  const results = await Promise.allSettled(
    Object.values(SPORT_MAP).map(sport => fetchOddsForSport(sport))
  );
  const merged = {};
  for (const r of results) {
    if (r.status === 'fulfilled') Object.assign(merged, r.value);
  }
  _oddsCache = { data: merged, fetchedAt: Date.now() };
  return merged;
}

module.exports = { fetchAllOdds, SPORT_MAP };
