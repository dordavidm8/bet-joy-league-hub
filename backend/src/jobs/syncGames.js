/**
 * Cron job: sync live game data from API-Football
 * Runs every 60 seconds while there are live games
 * Emits real-time updates via Socket.io
 */

const { pool } = require('../config/database');
const sportsApi = require('../services/sportsApi');

async function syncLiveGames(io) {
  try {
    const liveFixtures = await sportsApi.getLiveFixtures();
    if (!liveFixtures.length) return;

    for (const fixture of liveFixtures) {
      const apiId = fixture.fixture.id;
      const status = mapStatus(fixture.fixture.status.short);
      const minute = fixture.fixture.status.elapsed;
      const homeScore = fixture.goals.home ?? 0;
      const awayScore = fixture.goals.away ?? 0;

      const result = await pool.query(
        `UPDATE games
         SET status = $1, minute = $2, home_score = $3, away_score = $4,
             raw_data = $5, updated_at = NOW()
         WHERE api_id = $6
         RETURNING id`,
        [status, minute, homeScore, awayScore, JSON.stringify(fixture), apiId]
      );

      if (!result.rows[0]) continue;
      const gameId = result.rows[0].id;

      // Lock bet questions past their lock minute
      await pool.query(
        `UPDATE bet_questions
         SET is_locked = true
         WHERE game_id = $1
           AND is_locked = false
           AND live_lock_minute <= $2`,
        [gameId, minute]
      );

      // Emit live update to all clients watching this game
      io.to(`game:${gameId}`).emit('game_update', {
        game_id: gameId,
        minute,
        home_score: homeScore,
        away_score: awayScore,
        status,
      });
    }
  } catch (err) {
    console.error('[syncLiveGames] Error:', err.message);
  }
}

/**
 * Sync upcoming fixtures for the next 7 days
 * Runs once per day (or on demand)
 */
async function syncUpcomingFixtures() {
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    try {
      const fixtures = await sportsApi.getFixturesByDate(dateStr);
      for (const fixture of fixtures) {
        await upsertFixture(fixture);
      }
      console.log(`[syncUpcomingFixtures] Synced ${fixtures.length} fixtures for ${dateStr}`);
    } catch (err) {
      console.error(`[syncUpcomingFixtures] Error for ${dateStr}:`, err.message);
    }

    // Rate limit: API-Football free tier allows ~10 req/min
    await new Promise((r) => setTimeout(r, 7000));
  }
}

async function upsertFixture(fixture) {
  const {
    fixture: { id: apiId, date, status },
    teams: { home, away },
    league,
    goals,
  } = fixture;

  // Upsert competition
  const compRes = await pool.query(
    `INSERT INTO competitions (api_id, name, country, logo_url, season)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (api_id) DO UPDATE
       SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url
     RETURNING id`,
    [league.id, league.name, league.country, league.logo, league.season]
  );
  const competitionId = compRes.rows[0].id;

  await pool.query(
    `INSERT INTO games
       (api_id, competition_id, home_team, away_team, home_team_logo, away_team_logo,
        start_time, status, home_score, away_score, raw_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (api_id) DO UPDATE
       SET status = EXCLUDED.status,
           home_score = EXCLUDED.home_score,
           away_score = EXCLUDED.away_score,
           raw_data = EXCLUDED.raw_data,
           updated_at = NOW()`,
    [
      apiId, competitionId,
      home.name, away.name, home.logo, away.logo,
      date, mapStatus(status.short),
      goals.home, goals.away,
      JSON.stringify(fixture),
    ]
  );
}

function mapStatus(apiStatus) {
  const map = {
    TBD: 'scheduled', NS: 'scheduled',
    '1H': 'live', HT: 'live', '2H': 'live', ET: 'live', P: 'live',
    FT: 'finished', AET: 'finished', PEN: 'finished',
    PST: 'postponed', CANC: 'cancelled', ABD: 'cancelled',
  };
  return map[apiStatus] || 'scheduled';
}

module.exports = { syncLiveGames, syncUpcomingFixtures, upsertFixture };
