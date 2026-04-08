const { pool } = require('../config/database');
const { fetchAllOdds } = require('../services/oddsApi');
const { setOddsCache } = require('../services/sportsApi');
const { fetchAllGames, buildBetQuestions } = require('../services/sportsApi');

// ── Upsert a single game row ───────────────────────────────────────────────────
async function upsertGame(client, game) {
  const res = await client.query(
    `INSERT INTO games
       (espn_id, competition_id, home_team, away_team, home_team_logo, away_team_logo,
        start_time, status, minute, score_home, score_away, venue, espn_odds)
     VALUES ($1,
       (SELECT id FROM competitions WHERE slug = $2 LIMIT 1),
       $3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (espn_id) DO UPDATE SET
       status      = EXCLUDED.status,
       minute      = EXCLUDED.minute,
       score_home  = EXCLUDED.score_home,
       score_away  = EXCLUDED.score_away,
       espn_odds   = EXCLUDED.espn_odds,
       updated_at  = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    [
      game.espn_id, game.competition_slug,
      game.home_team, game.away_team,
      game.home_team_logo, game.away_team_logo,
      game.start_time, game.status, game.minute,
      game.score_home, game.score_away, game.venue,
      JSON.stringify(game.espn_odds)
    ]
  );
  return res.rows[0];
}

// ── Ensure default competitions exist ─────────────────────────────────────────
async function ensureCompetitions(client, slugs) {
  const names = {
    'eng.1':        'Premier League',
    'esp.1':        'La Liga',
    'ger.1':        'Bundesliga',
    'ita.1':        'Serie A',
    'fra.1':        'Ligue 1',
    'uefa.champions': 'UEFA Champions League',
    'isr.1':        'Israeli Premier League',
    'fifa.world':   'גביע העולם 2026',
  };
  for (const slug of slugs) {
    await client.query(
      `INSERT INTO competitions (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING`,
      [slug, names[slug] || slug]
    );
  }
}

// ── Seed bet questions for a newly inserted game ──────────────────────────────
async function seedBetQuestions(client, gameId, game) {
  const questions = buildBetQuestions(game);
  for (const q of questions) {
    await client.query(
      `INSERT INTO bet_questions (game_id, type, question_text, outcomes)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [gameId, q.type, q.question_text, JSON.stringify(q.outcomes)]
    );
  }
}

// ── Main sync function ────────────────────────────────────────────────────────
async function syncGames() {
  if (process.env.STUB_MODE === 'true') {
    // In stub mode we don't hit ESPN or write to DB
    console.log('[syncGames] STUB_MODE — skipping ESPN sync');
    return;
  }

  // Update odds cache before syncing games
  const oddsCache = await fetchAllOdds();
  setOddsCache(oddsCache);
  const oddsCount = Object.keys(oddsCache).length;
  if (oddsCount > 0) console.log(`[syncGames] Loaded real odds for ${oddsCount} matches`);

  console.log('[syncGames] Fetching games from ESPN…');
  let games;
  try {
    games = await fetchAllGames();
  } catch (err) {
    console.error('[syncGames] ESPN fetch failed:', err.message);
    return;
  }
  console.log(`[syncGames] Got ${games.length} games`);

  const slugs = [...new Set(games.map(g => g.competition_slug))];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureCompetitions(client, slugs);
    console.log(`[syncGames] Competitions verified: ${slugs.join(', ')}`);

    let inserted = 0, updated = 0;
    for (let j = 0; j < games.length; j++) {
      const game = games[j];
      const row = await upsertGame(client, game);
      if (row.inserted) {
        await seedBetQuestions(client, row.id, game);
        inserted++;
      } else {
        updated++;
      }
      if ((j + 1) % 50 === 0) console.log(`[syncGames] Processed ${j + 1}/${games.length} games…`);
    }

    await client.query('COMMIT');
    console.log(`[syncGames] Done — inserted ${inserted}, updated ${updated}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[syncGames] DB error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { syncGames };
