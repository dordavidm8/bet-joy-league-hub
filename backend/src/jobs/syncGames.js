const { pool } = require('../config/database');
const { fetchAllOdds } = require('../services/oddsApi');
const { setOddsCache } = require('../services/sportsApi');
const { fetchAllGames, buildBetQuestions } = require('../services/sportsApi');
const { queueUnknownTeams } = require('../lib/teamNames');

// ── Upsert a single game row ───────────────────────────────────────────────────
async function upsertGame(client, game) {
  // Capture current team names before upsert so we can detect knockout name changes
  const prev = await client.query(
    `SELECT home_team, away_team FROM games WHERE espn_id = $1`, [game.espn_id]
  );

  const res = await client.query(
    `INSERT INTO games
       (espn_id, competition_id, home_team, away_team, home_team_logo, away_team_logo,
        start_time, status, minute, score_home, score_away, venue, espn_odds)
     VALUES ($1,
       (SELECT id FROM competitions WHERE slug = $2 LIMIT 1),
       $3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (espn_id) DO UPDATE SET
       home_team      = EXCLUDED.home_team,
       away_team      = EXCLUDED.away_team,
       home_team_logo = EXCLUDED.home_team_logo,
       away_team_logo = EXCLUDED.away_team_logo,
       status         = EXCLUDED.status,
       start_time     = EXCLUDED.start_time,
       minute         = EXCLUDED.minute,
       score_home     = EXCLUDED.score_home,
       score_away     = EXCLUDED.score_away,
       espn_odds      = EXCLUDED.espn_odds,
       updated_at     = NOW()
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
  const row = res.rows[0];

  // Detect if team names changed (knockout stage: placeholder → real team)
  if (prev.rows[0]) {
    const { home_team: oldHome, away_team: oldAway } = prev.rows[0];
    row.teams_changed = oldHome !== game.home_team || oldAway !== game.away_team;
  }
  return row;
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
      `INSERT INTO bet_questions (game_id, type, question_text, outcomes, odds_source)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [gameId, q.type, q.question_text, JSON.stringify(q.outcomes), q.odds_source || 'default']
    );
  }
}

// ── Reseed bet questions when team names change (knockout stage) ───────────────
// Cancels and refunds any pending bets, then reseeds all questions
async function reseedBetQuestionsOnTeamChange(client, gameId, game) {
  // Find all pending bets on this game's questions
  const pendingBets = await client.query(`
    SELECT b.id, b.user_id, b.stake
    FROM bets b
    JOIN bet_questions bq ON bq.id = b.bet_question_id
    WHERE bq.game_id = $1 AND b.status = 'pending'
  `, [gameId]);

  if (pendingBets.rows.length > 0) {
    const betIds = pendingBets.rows.map(r => r.id);

    // Cancel all pending bets
    await client.query(`
      UPDATE bets SET status = 'cancelled' WHERE id = ANY($1::uuid[])
    `, [betIds]);

    // Refund stakes to each user's balance + log the transaction
    for (const bet of pendingBets.rows) {
      await client.query(`
        UPDATE users SET points_balance = points_balance + $1 WHERE id = $2
      `, [bet.stake, bet.user_id]);
      await client.query(`
        INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
        VALUES ($1, $2, 'bet_refund', $3, 'החזר הימור - שינוי קבוצות משחק')
      `, [bet.user_id, bet.stake, bet.id]);
    }
    console.log(`[syncGames] Cancelled ${pendingBets.rows.length} pending bets and refunded stakes for game ${gameId}`);
  }

  // Delete all bet questions (including those that had bets, which are now cancelled)
  await client.query(`DELETE FROM bet_questions WHERE game_id = $1`, [gameId]);
  await seedBetQuestions(client, gameId, game);
  console.log(`[syncGames] Reseeded bet questions for game ${gameId} (team names changed)`);
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
        if (row.teams_changed) {
          await reseedBetQuestionsOnTeamChange(client, row.id, game);
        }
        updated++;
      }
      if ((j + 1) % 50 === 0) console.log(`[syncGames] Processed ${j + 1}/${games.length} games…`);
    }

    await client.query('COMMIT');
    console.log(`[syncGames] Done — inserted ${inserted}, updated ${updated}`);

    // Queue unknown team names for LLM translation (fire-and-forget)
    const allNames = games.flatMap((g) => [g.home_team, g.away_team]);
    queueUnknownTeams(pool, allNames).catch(() => {});
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[syncGames] DB error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { syncGames };
