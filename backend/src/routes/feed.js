/**
 * routes/feed.js – פיד פעילות חברתי
 *
 * GET /feed – מחזיר סטרים של פעילות: הימורים שניצחו, הישגים, הצטרפות לליגות.
 * פרמטרים:
 *   filter – 'all' (כולם) | 'following' (רק עוקבים)
 *   limit  – גבול תוצאות (ברירת מחדל 20)
 *   offset – pagination
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/feed — recent wins + achievements from all users (last 48h)
// ?filter=following — show only users that the current user follows
router.get('/', authenticate, async (req, res, next) => {
  try {
    const followingOnly = req.query.filter === 'following';
    const followingSubquery = followingOnly
      ? `AND pt.user_id IN (SELECT followed_id FROM user_follows WHERE follower_id = $1)`
      : '';
    const achievFollowingSubquery = followingOnly
      ? `AND ua.user_id IN (SELECT followed_id FROM user_follows WHERE follower_id = $1)`
      : '';

    const [winsRes, achievementsRes] = await Promise.all([
      pool.query(
        `SELECT
           pt.id, pt.amount, pt.description, pt.created_at,
           u.id AS user_id, u.username, u.avatar_url
         FROM point_transactions pt
         JOIN users u ON u.id = pt.user_id
         WHERE pt.type IN ('bet_won', 'league_payout', 'weekly_bonus')
           AND pt.amount > 0
           AND pt.created_at >= NOW() - INTERVAL '48 hours'
           ${followingSubquery}
         ORDER BY pt.created_at DESC
         LIMIT 25`,
        followingOnly ? [req.user.id] : []
      ),
      pool.query(
        `SELECT
           ua.id, ua.achievement_key, ua.unlocked_at,
           u.id AS user_id, u.username, u.avatar_url
         FROM user_achievements ua
         JOIN users u ON u.id = ua.user_id
         WHERE ua.unlocked_at >= NOW() - INTERVAL '48 hours'
           ${achievFollowingSubquery}
         ORDER BY ua.unlocked_at DESC
         LIMIT 15`,
        followingOnly ? [req.user.id] : []
      ),
    ]);

    const wins = winsRes.rows.map(r => ({
      id: `win-${r.id}`,
      type: 'win',
      user: { id: r.user_id, username: r.username, avatar_url: r.avatar_url },
      amount: r.amount,
      description: r.description,
      created_at: r.created_at,
    }));

    const achievements = achievementsRes.rows.map(r => ({
      id: `ach-${r.id}`,
      type: 'achievement',
      user: { id: r.user_id, username: r.username, avatar_url: r.avatar_url },
      achievement_key: r.achievement_key,
      created_at: r.unlocked_at,
    }));

    const feed = [...wins, ...achievements]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 30);

    res.json({ feed });
  } catch (err) { next(err); }
});

module.exports = router;
