/**
 * socialAnalytics.js – רענון מדדי engagement
 *
 * רץ 8:00 UTC. מביא engagement metrics לכל הפוסטים שפורסמו
 * ושומר ב-social_post_analytics table.
 */
'use strict';

const { pool } = require('../config/database');
const { getSecret } = require('../lib/secrets');

/**
 * Social Analytics Job
 * Fetches post analytics from LinkedIn, Instagram, TikTok APIs.
 */
async function runDailyAnalyticsRefresh() {
  console.log('[socialAnalytics] Starting daily analytics refresh');

  try {
    // Get published posts from last 30 days
    const postsRes = await pool.query(
      `SELECT id, platform, published_id FROM social_posts
       WHERE status = 'published' AND published_id IS NOT NULL
         AND published_at > NOW() - INTERVAL '30 days'
       ORDER BY published_at DESC`
    );

    if (postsRes.rows.length === 0) {
      console.log('[socialAnalytics] No published posts to refresh');
      return;
    }

    for (const post of postsRes.rows) {
      try {
        let analytics = null;

        switch (post.platform) {
          case 'linkedin':
            analytics = await fetchLinkedInAnalytics(post.published_id);
            break;
          case 'instagram':
            analytics = await fetchInstagramAnalytics(post.published_id);
            break;
          case 'tiktok':
            analytics = await fetchTikTokAnalytics(post.published_id);
            break;
        }

        if (analytics) {
          await pool.query(
            `INSERT INTO social_post_analytics
               (post_id, impressions, reach, likes, comments, shares, saves, clicks, engagement_rate)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              post.id,
              analytics.impressions || 0,
              analytics.reach || 0,
              analytics.likes || 0,
              analytics.comments || 0,
              analytics.shares || 0,
              analytics.saves || 0,
              analytics.clicks || 0,
              analytics.engagement_rate || 0,
            ]
          );
        }
      } catch (err) {
        console.error(`[socialAnalytics] Error fetching analytics for ${post.platform}/${post.id}:`, err.message);
      }
    }

    console.log(`[socialAnalytics] Refreshed ${postsRes.rows.length} posts`);
  } catch (err) {
    console.error('[socialAnalytics] Error:', err.message);
  }
}

async function fetchLinkedInAnalytics(publishedId) {
  const token = await getSecret('LINKEDIN_ACCESS_TOKEN');
  if (!token || !publishedId) return null;

  try {
    const res = await fetch(
      `https://api.linkedin.com/v2/socialActions/${publishedId}/summaryByUrn`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      likes: data.likesSummary?.totalLikes || 0,
      comments: data.commentsSummary?.totalFirstLevelComments || 0,
      shares: data.sharesSummary?.totalShares || 0,
    };
  } catch { return null; }
}

async function fetchInstagramAnalytics(publishedId) {
  const token = await getSecret('INSTAGRAM_ACCESS_TOKEN');
  if (!token || !publishedId) return null;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${publishedId}/insights?metric=impressions,reach,likes,comments,saved&access_token=${token}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const metrics = {};
    for (const m of data.data || []) {
      metrics[m.name] = m.values?.[0]?.value || 0;
    }
    return {
      impressions: metrics.impressions || 0,
      reach: metrics.reach || 0,
      likes: metrics.likes || 0,
      comments: metrics.comments || 0,
      saves: metrics.saved || 0,
    };
  } catch { return null; }
}

async function fetchTikTokAnalytics(publishedId) {
  const token = await getSecret('TIKTOK_ACCESS_TOKEN');
  if (!token || !publishedId) return null;

  try {
    const res = await fetch(
      `https://open.tiktokapis.com/v2/video/query/?fields=id,like_count,comment_count,share_count,view_count`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filters: { video_ids: [publishedId] } }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const video = data.data?.videos?.[0];
    if (!video) return null;
    return {
      impressions: video.view_count || 0,
      likes: video.like_count || 0,
      comments: video.comment_count || 0,
      shares: video.share_count || 0,
    };
  } catch { return null; }
}

module.exports = { runDailyAnalyticsRefresh };
