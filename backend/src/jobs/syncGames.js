/**
 * Cron job: sync game data from ESPN Unofficial API
 */

const { pool } = require('../config/database');
const sportsApi = require('../services/sportsApi');

/**
 * Sync all games for all supported leagues for today
 * Emits real-time updates via Socket.io
 */
async function syncLiveGames(io) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const fixtures = await sportsApi.getAllFixturesByDate(today);

    if (!fixtures.length) return;

    for (const event of fixtures) {
      const competition = event.competitions[0];
      const apiId = event.id;
      const status = mapStatus(competition.status.type.name);
      const minute = competition.status.clock || 0;
      const home = competition.competitors.find(c => c.homeAway === 'home');
      const away = competition.competitors.find(c => c.homeAway === 'away');
      const homeScore = parseInt(home.score) || 0;
      const awayScore = parseInt(away.score) || 0;

      const result = await pool.query(
        `UPDATE games
         SET status = $1, minute = $2, home_score = $3, away_score = $4,
             raw_data = $5, updated_at = NOW()
         WHERE api_id = $6
         RETURNING id`,
        [status, Math.floor(minute / 60), homeScore, awayScore, JSON.stringify(event), apiId]
      );

      if (!result.rows[0]) {
        // If game doesn't exist yet, we might want to upsert it
        await upsertFixture(event);
        continue;
      }

      const gameId = result.rows[0].id;

      // Lock bet questions past their lock minute
      await pool.query(
        `UPDATE bet_questions
         SET is_locked = true
         WHERE game_id = $1
           AND is_locked = false
           AND live_lock_minute <= $2`,
        [gameId, Math.floor(minute / 60)]
      );

      // Emit live update
      if (io) {
        io.to(`game:${gameId}`).emit('game_update', {
          game_id: gameId,
          minute: Math.floor(minute / 60),
          home_score: homeScore,
          away_score: awayScore,
          status,
        });
      }
    }
  } catch (err) {
    console.error('[syncLiveGames] Error:', err.message);
  }
}

/**
 * Sync upcoming fixtures for the next 7 days for all supported leagues
 */
async function syncUpcomingFixtures() {
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    try {
      const fixtures = await sportsApi.getAllFixturesByDate(dateStr);
      for (const event of fixtures) {
        await upsertFixture(event);
      }
      console.log(`[syncUpcomingFixtures] Synced ${fixtures.length} events for ${dateStr}`);
    } catch (err) {
      console.error(`[syncUpcomingFixtures] Error for ${dateStr}:`, err.message || err);
    }
  }
}

async function upsertFixture(event) {
  const competition = event.competitions[0];
  const apiId = event.id;
  const startTime = event.date;
  const status = mapStatus(competition.status.type.name);

  const home = competition.competitors.find(c => c.homeAway === 'home');
  const away = competition.competitors.find(c => c.homeAway === 'away');

  const league = event.leagueInfo;

  // 1. Upsert competition
  const compRes = await pool.query(
    `INSERT INTO competitions (api_id, name, country, logo_url, season)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (api_id) DO UPDATE
       SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url
     RETURNING id`,
    [
      parseInt(league.id) || 0, // ESPN IDs can be strings/named
      league.name || league.displayName,
      'International', // ESPN doesn't always provide country at this level
      league.logos?.[0]?.href,
      new Date().getFullYear()
    ]
  );
  const competitionId = compRes.rows[0].id;

  // 2. Upsert game
  const gameRes = await pool.query(
    `INSERT INTO games
       (api_id, competition_id, home_team, away_team, home_team_logo, away_team_logo,
        start_time, status, home_score, away_score, raw_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (api_id) DO UPDATE
       SET status = EXCLUDED.status,
           home_score = EXCLUDED.home_score,
           away_score = EXCLUDED.away_score,
           raw_data = EXCLUDED.raw_data,
           updated_at = NOW()
     RETURNING id`,
    [
      apiId, competitionId,
      home.team.displayName, away.team.displayName,
      home.team.logo, away.team.logo,
      startTime, status,
      parseInt(home.score) || 0, parseInt(away.score) || 0,
      JSON.stringify(event),
    ]
  );

  const gameId = gameRes.rows[0].id;

  // 3. Generate bet questions if they don't exist
  const questionsCount = await pool.query(
    'SELECT count(*) FROM bet_questions WHERE game_id = $1',
    [gameId]
  );

  if (parseInt(questionsCount.rows[0].count) === 0) {
    const questions = sportsApi.buildBetQuestions(event);
    for (const q of questions) {
      await pool.query(
        `INSERT INTO bet_questions (game_id, question_type, question_text, options, live_lock_minute)
         VALUES ($1,$2,$3,$4,$5)`,
        [gameId, q.question_type, q.question_text, JSON.stringify(q.options), q.live_lock_minute]
      );
    }
  }
}

function mapStatus(espnStatus) {
  const map = {
    'STATUS_SCHEDULED': 'scheduled',
    'STATUS_IN_PROGRESS': 'live',
    'STATUS_HALFTIME': 'live',
    'STATUS_FIRST_HALF': 'live',
    'STATUS_SECOND_HALF': 'live',
    'STATUS_FULL_TIME': 'finished',
    'STATUS_FINAL': 'finished',
    'STATUS_POSTPONED': 'postponed',
    'STATUS_CANCELED': 'cancelled',
  };
  return map[espnStatus] || 'scheduled';
}

module.exports = { syncLiveGames, syncUpcomingFixtures, upsertFixture };
