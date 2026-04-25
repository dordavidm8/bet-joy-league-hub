/**
 * settleBets.js – סגירת הימורים אוטומטית
 *
 * רץ כל 5 דקות. מוצא משחקים שהסתיימו ומסגיר את כל ההימורים עליהם:
 *   - מחשב תוצאת כל שאלה (מנצח, BTTS, over/under, exact score)
 *   - לכל הימור שניצח: מחשב payout (stake × odds × (1 - penalty))
 *   - מעדכן points_balance של המשתמש
 *   - רושם point_transaction
 *   - מסגיר פרלי (רק אם כל ה-legs ניצחו)
 *   - מסגיר הימורי ליגה בנפרד מהימורים גלובליים
 */
const { pool } = require('../config/database');
const { calculatePayout } = require('../services/bettingService');
const { settleLeaguePool } = require('../routes/leagues');
const { createNotification } = require('../services/notificationService');
const { checkAndAwardAchievements } = require('../services/achievementService');
const { translateTeam } = require('../lib/teamNames');

// ── Resolve a bet_question's correct_outcome based on final score ─────────────
// Returns the winning outcome label (matching the stored label in question.outcomes),
// or null if we can't determine yet.
// Outcomes may be stored in Hebrew (translated) or English — we match whichever is present.
function resolveQuestion(question, game) {
  if (game.status !== 'finished') return null;

  const h = game.score_home;
  const a = game.score_away;
  const type = question.type;
  const outcomes = Array.isArray(question.outcomes) ? question.outcomes : [];

  if (type === 'match_winner') {
    // outcomes order from buildBetQuestions: [home(0), draw(1), away(2)]
    if (h > a) {
      const heHome = translateTeam(game.home_team);
      const found = outcomes.find(o => o.label === game.home_team || o.label === heHome);
      return found?.label ?? outcomes[0]?.label ?? heHome;
    }
    if (a > h) {
      const heAway = translateTeam(game.away_team);
      const found = outcomes.find(o => o.label === game.away_team || o.label === heAway);
      return found?.label ?? outcomes[2]?.label ?? heAway;
    }
    // Draw
    const drawFound = outcomes.find(o => ['תיקו', 'Draw'].includes(o.label));
    return drawFound?.label ?? outcomes[1]?.label ?? 'תיקו';
  }

  if (type === 'both_teams_score') {
    const yes = h > 0 && a > 0;
    const found = outcomes.find(o =>
      yes ? ['כן', 'Yes'].includes(o.label) : ['לא', 'No'].includes(o.label)
    );
    return found?.label ?? (yes ? 'כן' : 'לא');
  }

  if (type === 'over_under') {
    const over = (h + a) > 2.5;
    const found = outcomes.find(o =>
      over
        ? (o.label.includes('מעל') || o.label.toLowerCase().includes('over'))
        : (o.label.includes('מתחת') || o.label.toLowerCase().includes('under'))
    );
    return found?.label ?? (over ? 'מעל 2.5' : 'מתחת 2.5');
  }

  return null; // unknown question type
}

// ── Settle all pending bets for finished games ────────────────────────────────
async function settleBets() {
  if (process.env.STUB_MODE === 'true') {
    console.log('[settleBets] STUB_MODE — skipping settlement');
    return;
  }

  // Fetch finished games that still have pending bets
  const gamesRes = await pool.query(
    `SELECT DISTINCT g.id, g.home_team, g.away_team, g.score_home, g.score_away, g.status
     FROM games g
     JOIN bets b ON b.game_id = g.id
     WHERE g.status = 'finished' AND b.status = 'pending'`
  );

  if (!gamesRes.rows.length) {
    console.log('[settleBets] No pending bets for finished games');
    return;
  }

  console.log(`[settleBets] Settling bets for ${gamesRes.rows.length} games…`);

  for (const game of gamesRes.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Resolve all bet_questions for this game
      const questionsRes = await client.query(
        `SELECT * FROM bet_questions WHERE game_id = $1`, [game.id]
      );

      const correctOutcomeMap = {}; // questionId → winning label
      for (const q of questionsRes.rows) {
        const winner = resolveQuestion(q, game);
        if (winner !== null) {
          correctOutcomeMap[q.id] = winner;
          await client.query(
            `UPDATE bet_questions SET correct_outcome = $1, resolved_at = NOW() WHERE id = $2`,
            [winner, q.id]
          );
        }
      }

      // Fetch pending bets for this game
      const betsRes = await client.query(
        `SELECT * FROM bets WHERE game_id = $1 AND status = 'pending'`, [game.id]
      );

      // Preload bet_mode for all leagues referenced in this game's bets
      const uniqueLeagueIds = [...new Set(betsRes.rows.filter(b => b.league_id).map(b => b.league_id))];
      const leagueModes = {};
      if (uniqueLeagueIds.length > 0) {
        const lRes = await client.query(
          `SELECT id, bet_mode FROM leagues WHERE id = ANY($1::uuid[])`,
          [uniqueLeagueIds]
        );
        for (const l of lRes.rows) leagueModes[l.id] = l.bet_mode;
      }

      let settledWon = 0, settledLost = 0;
      const userBetResults = {}; // userId → { won, lost, totalPayout, leaguePoints }

      // Fixed outcome label aliases: English → Hebrew. Used for bets placed when labels were in English.
      const OUTCOME_EN_TO_HE = { 'Draw': 'תיקו', 'Yes': 'כן', 'No': 'לא' };

      for (const bet of betsRes.rows) {
        const correctOutcome = correctOutcomeMap[bet.bet_question_id];
        if (correctOutcome === undefined) continue; // question not resolved yet

        // Language-agnostic comparison: translate English→Hebrew in case the bet was placed when
        // outcome labels were still in English but the question was later re-seeded with Hebrew labels.
        const heSelectedOutcome = OUTCOME_EN_TO_HE[bet.selected_outcome] ?? translateTeam(bet.selected_outcome);
        const won = bet.selected_outcome === correctOutcome || heSelectedOutcome === correctOutcome;
        const betMode = bet.league_id ? (leagueModes[bet.league_id] ?? 'minimum_stake') : null;
        const isInitialBalance = betMode === 'initial_balance';

        // Exact score bonus: ×3 if prediction matches actual score
        const exactScoreHit = won &&
          bet.exact_score_prediction &&
          game.score_home != null && game.score_away != null &&
          bet.exact_score_prediction === `${game.score_home}-${game.score_away}`;
        const payoutMultiplier = exactScoreHit ? 3 : 1;

        // Balance Payout (for users.points_balance) vs League Points (for league_members.points_in_league)
        // For initial_balance leagues, actual_payout stores the league points earned.
        let balancePayout = 0;
        let leaguePointsPayout = 0;

        if (won) {
          if (isInitialBalance) {
            leaguePointsPayout = parseFloat(bet.odds) * payoutMultiplier;
          } else {
            balancePayout = calculatePayout(bet.stake, bet.odds, bet.live_penalty_pct || 0) * payoutMultiplier;
            leaguePointsPayout = balancePayout;
          }
        }

        const storedPayout = isInitialBalance ? leaguePointsPayout : balancePayout;

        await client.query(
          `UPDATE bets SET status = $1, actual_payout = $2, settled_at = NOW() WHERE id = $3`,
          [won ? 'won' : 'lost', storedPayout, bet.id]
        );

        if (won) {
          if (isInitialBalance) {
            // initial_balance league: credit odds-based points to league standing
            await client.query(
              `UPDATE league_members
               SET points_in_league = points_in_league + $1
               WHERE league_id = $2 AND user_id = $3 AND is_active = true`,
              [leaguePointsPayout, bet.league_id, bet.user_id]
            );
            // Also increment global win counter for stats
            await client.query(`UPDATE users SET total_wins = total_wins + 1 WHERE id = $1`, [bet.user_id]);
          } else if (bet.league_id) {
            // minimum_stake league: credit global balance + this league's standings
            await client.query(
              `UPDATE users SET points_balance = points_balance + $1, total_wins = total_wins + 1 WHERE id = $2`,
              [balancePayout, bet.user_id]
            );
            await client.query(
              `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
               VALUES ($1,$2,'bet_won',$3,$4)`,
              [bet.user_id, balancePayout, bet.id, `Bet won: ${game.home_team} vs ${game.away_team}`]
            );
            await client.query(
              `UPDATE league_members
               SET points_in_league = points_in_league + $1
               WHERE league_id = $2 AND user_id = $3 AND is_active = true`,
              [leaguePointsPayout, bet.league_id, bet.user_id]
            );
          } else {
            // Global bet (no league): credit global balance only
            await client.query(
              `UPDATE users SET points_balance = points_balance + $1, total_wins = total_wins + 1 WHERE id = $2`,
              [balancePayout, bet.user_id]
            );
            await client.query(
              `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
               VALUES ($1,$2,'bet_won',$3,$4)`,
              [bet.user_id, balancePayout, bet.id, `Bet won: ${game.home_team} vs ${game.away_team}`]
            );
          }

          settledWon++;
        } else {
          settledLost++;
        }

        // Track for per-user notification
        if (!userBetResults[bet.user_id]) userBetResults[bet.user_id] = { won: 0, lost: 0, totalPayout: 0, leaguePoints: 0, exactScoreHits: 0 };
        if (won) {
          userBetResults[bet.user_id].won++;
          if (exactScoreHit) userBetResults[bet.user_id].exactScoreHits++;
          if (isInitialBalance) {
            userBetResults[bet.user_id].leaguePoints += leaguePointsPayout;
          } else {
            userBetResults[bet.user_id].totalPayout += balancePayout;
          }
        } else { userBetResults[bet.user_id].lost++; }
      }

      // Also settle parlays that include this game's bets
      await settleParlays(client, game.id, correctOutcomeMap);

      await client.query('COMMIT');
      console.log(`[settleBets] Game ${game.id}: ${settledWon} won, ${settledLost} lost`);

      // Achievement checks + notifications per user (best-effort, after commit)
      for (const [userId, r] of Object.entries(userBetResults)) {
        if (r.won > 0) checkAndAwardAchievements(userId, 'bet_won').catch(() => {});
      }

      // WhatsApp result notification (best-effort)
      try {
        const { notifyGameResult } = require('../services/whatsappBotService');
        notifyGameResult(game.id).catch(() => {});
      } catch (_) {}

      // Send one notification per user summarising their results for this game (best effort)
      for (const [userId, r] of Object.entries(userBetResults)) {
        if (r.won > 0 && r.lost === 0) {
          const exactBonus = r.exactScoreHits > 0 ? ' 🎯 בונוס תוצאה מדויקת!' : '';
          const payoutDesc = r.totalPayout > 0
            ? `זכית ב-${r.totalPayout.toLocaleString()} נקודות${exactBonus}`
            : `זכית ב-${r.leaguePoints.toFixed(1)} נקודות בליגה${exactBonus}`;
          createNotification(userId, {
            type: 'bet_won',
            title: '✅ הימור מוצלח!',
            body: `${payoutDesc} על ${translateTeam(game.home_team)} נגד ${translateTeam(game.away_team)}`,
            data: { game_id: game.id },
          }).catch(() => {});
        } else if (r.lost > 0 && r.won === 0) {
          createNotification(userId, {
            type: 'bet_lost',
            title: '❌ הימור לא הצליח',
            body: `${translateTeam(game.home_team)} נגד ${translateTeam(game.away_team)}`,
            data: { game_id: game.id },
          }).catch(() => {});
        } else if (r.won > 0 && r.lost > 0) {
          const mixedDesc = r.totalPayout > 0
            ? `זכית ב-${r.totalPayout.toLocaleString()} נקודות`
            : `זכית ב-${r.leaguePoints.toFixed(1)} נקודות בליגה`;
          createNotification(userId, {
            type: 'bet_won',
            title: `✅ ${r.won} הימורים עברו`,
            body: `${mixedDesc} על ${translateTeam(game.home_team)} נגד ${translateTeam(game.away_team)}`,
            data: { game_id: game.id },
          }).catch(() => {});
        }
      }
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[settleBets] Error settling game ${game.id}:`, err.message);
    } finally {
      client.release();
    }
  }

  // Apply penalties for tournament members who missed bets
  await applyTournamentMissedBetPenalties(gamesRes.rows.map(g => g.id));

  // Auto-settle tournament leagues where all games are finished and bets cleared
  await autoSettleTournamentLeagues();
}

// ── Settle parlays: a parlay wins only if ALL its legs win ────────────────────
// Short-circuits as soon as any leg loses. Payout = sum(stake × odds) × 1.1.
async function settleParlays(client, gameId, correctOutcomeMap) {
  // Find parlays that have legs on this game and are still pending
  const parlayRes = await client.query(
    `SELECT DISTINCT p.id FROM parlays p
     JOIN bets b ON b.parlay_id = p.id
     WHERE b.game_id = $1 AND p.status = 'pending'`,
    [gameId]
  );

  for (const { id: parlayId } of parlayRes.rows) {
    const parlayRow = await client.query(`SELECT * FROM parlays WHERE id = $1`, [parlayId]);
    const parlay = parlayRow.rows[0];
    if (!parlay) continue;

    // Fetch all legs with their current status and individual stake
    const legsRes = await client.query(
      `SELECT b.id, b.status, b.stake, b.odds FROM bets b WHERE b.parlay_id = $1`,
      [parlayId]
    );

    // If any leg was cancelled, refund the whole parlay stake
    const anyCancelled = legsRes.rows.some(l => l.status === 'cancelled');
    if (anyCancelled) {
      await client.query(
        `UPDATE parlays SET status = 'cancelled', actual_payout = $1, settled_at = NOW() WHERE id = $2`,
        [parlay.total_stake, parlayId]
      );
      await client.query(
        `UPDATE users SET points_balance = points_balance + $1 WHERE id = $2`,
        [parlay.total_stake, parlay.user_id]
      );
      await client.query(
        `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
         VALUES ($1,$2,'bet_cancelled',$3,$4)`,
        [parlay.user_id, parlay.total_stake, parlayId,
         `פרליי #${parlay.parlay_number} בוטל — רגל אחת בוטלה, הסכום הוחזר`]
      );
      continue;
    }

    const anyLost = legsRes.rows.some(l => l.status === 'lost' || l.status === 'parlay_failed');

    // Short-circuit: if any leg just lost, fail the whole parlay immediately
    if (anyLost) {
      // Mark remaining pending legs as parlay_failed
      const pendingLegIds = legsRes.rows.filter(l => l.status === 'pending').map(l => l.id);
      if (pendingLegIds.length > 0) {
        await client.query(
          `UPDATE bets SET status = 'parlay_failed', settled_at = NOW() WHERE id = ANY($1::uuid[])`,
          [pendingLegIds]
        );
      }
      // Already-settled lost leg(s) are already status='lost'
      await client.query(
        `UPDATE parlays SET status = 'lost', actual_payout = 0, settled_at = NOW() WHERE id = $1`,
        [parlayId]
      );
      createNotification(parlay.user_id, {
        type: 'bet_lost',
        title: `❌ פרליי #${parlay.parlay_number} נכשל`,
        body: `לפחות אחת מהבחירות לא הצליחה — קיבלת 0 נקודות`,
        data: { parlay_id: parlayId, parlay_number: parlay.parlay_number },
      }).catch(() => {});
      continue;
    }

    // Check if ALL legs are now settled (won)
    const allSettled = legsRes.rows.every(l => l.status !== 'pending');
    if (!allSettled) continue; // Still waiting for other legs

    const allWon = legsRes.rows.every(l => l.status === 'won');
    if (!allWon) continue; // Shouldn't reach here but safety check

    // Calculate payout: sum(stake × odds) × 1.1
    const payout = Math.floor(
      legsRes.rows.reduce((sum, l) => sum + parseFloat(l.stake) * parseFloat(l.odds), 0) * 1.1
    );

    await client.query(
      `UPDATE parlays SET status = 'won', actual_payout = $1, settled_at = NOW() WHERE id = $2`,
      [payout, parlayId]
    );

    await client.query(
      `UPDATE users SET points_balance = points_balance + $1, total_wins = total_wins + 1 WHERE id = $2`,
      [payout, parlay.user_id]
    );
    await client.query(
      `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
       VALUES ($1,$2,'bet_won',$3,$4)`,
      [parlay.user_id, payout, parlayId, `פרליי #${parlay.parlay_number} ניצח!`]
    );
    // Award achievement + notification (best-effort, outside transaction)
    checkAndAwardAchievements(parlay.user_id, 'parlay_won').catch(() => {});
    createNotification(parlay.user_id, {
      type: 'bet_won',
      title: `🎉 פרליי #${parlay.parlay_number} ניצח!`,
      body: `כל ${legsRes.rows.length} הבחירות הצליחו — זכית ב-${payout.toLocaleString()} נקודות!`,
      data: { parlay_id: parlayId, parlay_number: parlay.parlay_number },
    }).catch(() => {});
  }
}


// ── Apply missed-bet penalties for tournament leagues ─────────────────────────
// Called after bet settlement. For each finished game that belongs to a
// tournament league with penalty_per_missed_bet > 0, deduct the penalty from
// any active member who had enough points but did NOT place a bet.
async function applyTournamentMissedBetPenalties(gameIds) {
  if (!gameIds || gameIds.length === 0) return;
  try {
    // Find tournament leagues that cover any of the settled games
    const leaguesRes = await pool.query(
      `SELECT DISTINCT l.* FROM leagues l
       JOIN competitions c ON c.slug = l.tournament_slug
       JOIN games g ON g.competition_id = c.id
       WHERE l.is_tournament = true
         AND l.status = 'active'
         AND l.penalty_per_missed_bet > 0
         AND g.id = ANY($1::uuid[])`,
      [gameIds]
    );

    for (const league of leaguesRes.rows) {
      const penalty = league.penalty_per_missed_bet;

      // Get all finished games in this tournament that were just settled
      const gamesRes = await pool.query(
        `SELECT g.id FROM games g
         JOIN competitions c ON c.id = g.competition_id
         WHERE c.slug = $1
           AND g.status = 'finished'
           AND g.id = ANY($2::uuid[])`,
        [league.tournament_slug, gameIds]
      );

      for (const game of gamesRes.rows) {
        // Get active members who have NOT bet on this game and have enough balance
        const missedRes = await pool.query(
          `SELECT lm.user_id FROM league_members lm
           JOIN users u ON u.id = lm.user_id
           WHERE lm.league_id = $1
             AND lm.is_active = true
             AND u.points_balance >= $2
             AND NOT EXISTS (
               SELECT 1 FROM bets b
               WHERE b.game_id = $3 AND b.user_id = lm.user_id AND b.league_id = $1
             )
             AND NOT EXISTS (
               SELECT 1 FROM tournament_missed_bets tmb
               WHERE tmb.league_id = $1 AND tmb.user_id = lm.user_id AND tmb.game_id = $3
             )`,
          [league.id, penalty, game.id]
        );

        if (missedRes.rows.length === 0) continue;

        // Batch all penalties for this (league, game) in a single transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          let appliedCount = 0;
          for (const { user_id } of missedRes.rows) {
            // Guard against race condition — only deduct if user still has enough balance
            const penaltyRes = await client.query(
              `UPDATE users SET points_balance = points_balance - $1 WHERE id = $2 AND points_balance >= $1 RETURNING id`,
              [penalty, user_id]
            );
            if (!penaltyRes.rows[0]) {
              console.log(`[settleBets] Skipping penalty for user ${user_id} — insufficient balance`);
              continue;
            }
            await client.query(
              `UPDATE league_members SET points_in_league = points_in_league - $1 WHERE league_id = $2 AND user_id = $3`,
              [penalty, league.id, user_id]
            );
            await client.query(
              `INSERT INTO point_transactions (user_id, amount, type, reference_id, description)
               VALUES ($1, $2, 'league_penalty', $3, $4)`,
              [user_id, -penalty, league.id, `ענישה על אי-הימור: ${league.name}`]
            );
            await client.query(
              `INSERT INTO tournament_missed_bets (league_id, user_id, game_id, penalty_applied)
               VALUES ($1, $2, $3, $4) ON CONFLICT (league_id, user_id, game_id) DO NOTHING`,
              [league.id, user_id, game.id, penalty]
            );
            appliedCount++;
          }
          await client.query('COMMIT');
          if (appliedCount > 0) {
            console.log(`[settleBets] Penalty ${penalty} applied to ${appliedCount} users for game ${game.id} in league ${league.name}`);
          }
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[settleBets] Batch penalty error for game ${game.id} in league ${league.name}:`, err.message);
        } finally {
          client.release();
        }
      }
    }
  } catch (err) {
    console.error('[settleBets] applyTournamentMissedBetPenalties error:', err.message);
  }
}

// ── Auto-settle tournament leagues ────────────────────────────────────────────
async function autoSettleTournamentLeagues() {
  try {
    // Find tournament leagues with auto_settle=true where every game in the
    // tournament is finished AND has no pending bets
    const leaguesRes = await pool.query(
      `SELECT l.* FROM leagues l
       WHERE l.is_tournament = true
         AND l.status = 'active'
         AND l.auto_settle = true
         AND l.tournament_slug IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM games g
           JOIN competitions c ON c.id = g.competition_id
           WHERE c.slug = l.tournament_slug
             AND (
               g.status != 'finished'
               OR EXISTS (SELECT 1 FROM bets b WHERE b.game_id = g.id AND b.status = 'pending')
             )
         )`
    );

    for (const league of leaguesRes.rows) {
      let settled = false;
      for (let attempt = 1; attempt <= 3 && !settled; attempt++) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          console.log(`[settleBets] Auto-settling tournament league: ${league.name} (attempt ${attempt})`);
          await settleLeaguePool(client, league);
          await client.query('COMMIT');
          console.log(`[settleBets] Tournament league settled: ${league.name}`);
          settled = true;
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[settleBets] Auto-settle attempt ${attempt}/3 failed for "${league.name}":`, err.message);
          if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
        } finally {
          client.release();
        }
      }
      if (!settled) {
        console.error(`[settleBets] CRITICAL: All 3 auto-settle attempts failed for league "${league.name}" (id: ${league.id}). Manual intervention required.`);
      }
    }
  } catch (err) {
    console.error('[settleBets] autoSettleTournamentLeagues error:', err.message);
  }
}

module.exports = { settleBets };
