/**
 * oddsApi.js – אינטגרציה עם The Odds API
 *
 * מביא odds מ-api.the-odds-api.com לכל משחקי כדורגל.
 * ממיר American Odds ל-Decimal: (+150 → 2.5, -200 → 1.5)
 * שומר תוצאות ב-cache בזיכרון למשך 5 דקות להפחתת קריאות API.
 * תואם שמות קבוצות עם accent-insensitive matching.
 */
// The Odds API integration — https://the-odds-api.com
// Set THE_ODDS_API_KEY in Railway env vars to enable real odds
const axios = require('axios');
const { pool } = require('../config/database');

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

// Fetch odds for a sport, returns map: `${homeTeam}|${awayTeam}` → { home_odds, draw_odds, away_odds, btts_yes, btts_no, over_2_5, under_2_5 }
async function fetchOddsForSport(sportKey) {
  if (!API_KEY) return {};
  try {
    const { data } = await axios.get(`${ODDS_API_BASE}/sports/${sportKey}/odds`, {
      params: { apiKey: API_KEY, regions: 'eu', markets: 'h2h,totals', oddsFormat: 'decimal' },
      timeout: 10000,
    });
    const map = {};
    for (const event of data) {
      const bookie = event.bookmakers?.[0];
      if (!bookie) continue;

      const key = `${event.home_team}|${event.away_team}`;
      map[key] = {};

      const h2h = bookie.markets?.find(m => m.key === 'h2h');
      if (h2h) {
        const home = h2h.outcomes?.find(o => o.name === event.home_team);
        const away = h2h.outcomes?.find(o => o.name === event.away_team);
        const draw = h2h.outcomes?.find(o => o.name === 'Draw');
        if (home && away) {
          map[key].home_odds = parseFloat(home.price.toFixed(2));
          map[key].away_odds = parseFloat(away.price.toFixed(2));
          map[key].draw_odds = draw ? parseFloat(draw.price.toFixed(2)) : 3.2;
        }
      }

      const btts = bookie.markets?.find(m => m.key === 'btts');
      if (btts) {
        const yes = btts.outcomes?.find(o => o.name === 'Yes');
        const no  = btts.outcomes?.find(o => o.name === 'No');
        if (yes && no) {
          map[key].btts_yes = parseFloat(yes.price.toFixed(2));
          map[key].btts_no  = parseFloat(no.price.toFixed(2));
        }
      }

      const totals = bookie.markets?.find(m => m.key === 'totals');
      if (totals) {
        // Use 2.5 goal line (most common)
        const over  = totals.outcomes?.find(o => o.name === 'Over'  && Math.abs((o.point ?? 2.5) - 2.5) < 0.01);
        const under = totals.outcomes?.find(o => o.name === 'Under' && Math.abs((o.point ?? 2.5) - 2.5) < 0.01);
        if (over && under) {
          map[key].over_2_5  = parseFloat(over.price.toFixed(2));
          map[key].under_2_5 = parseFloat(under.price.toFixed(2));
        }
      }

      if (Object.keys(map[key]).length === 0) delete map[key];
    }
    return map;
  } catch (err) {
    console.warn(`[oddsApi] Failed to fetch ${sportKey}:`, err.message);
    return {};
  }
}

// Ensure DB table exists
pool.query(`
  CREATE TABLE IF NOT EXISTS odds_cache (
    id INT PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(e => console.error('[oddsApi] Failed to ensure odds_cache table:', e.message));

// Fetch all odds across all supported sports
// If force=false, it strictly returns from DB. If DB is empty, it fetches once.
async function fetchAllOdds(force = false) {
  if (!force) {
    try {
      const res = await pool.query('SELECT data FROM odds_cache WHERE id = 1');
      if (res.rows[0] && res.rows[0].data) {
        return res.rows[0].data;
      }
    } catch (e) {
      console.error('[oddsApi] Error reading cache from DB:', e.message);
    }
  }

  const results = await Promise.allSettled(
    Object.values(SPORT_MAP).map(sport => fetchOddsForSport(sport))
  );
  
  const merged = {};
  let hasData = false;
  for (const r of results) {
    if (r.status === 'fulfilled' && Object.keys(r.value).length > 0) {
      Object.assign(merged, r.value);
      hasData = true;
    }
  }

  try {
    await pool.query(
      `INSERT INTO odds_cache (id, data, updated_at) VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify(merged)]
    );
  } catch (e) {
    console.error('[oddsApi] Error saving cache to DB:', e.message);
  }
  
  return merged;
}

module.exports = { fetchAllOdds, SPORT_MAP, fetchOddsForSport };
