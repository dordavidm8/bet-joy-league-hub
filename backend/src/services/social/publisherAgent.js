/**
 * publisherAgent.js – סוכן פרסום
 *
 * publishPost(context) –
 *   מפרסם פוסטים מאושרים לפלטפורמות מדיה חברתית.
 *   תומך ב: LinkedIn API, Instagram Graph API, TikTok API.
 *   שומר post ID מהפלטפורמה לצורך tracking analytics בהמשך.
 */
'use strict';

const { getSecret } = require('../../lib/secrets');
const { updatePost } = require('./socialMediaUtils');

/**
 * Publisher Agent
 * Publishes approved posts to LinkedIn, Instagram, and TikTok via their APIs.
 */
async function publish(ctx) {
  const startedAt = Date.now();
  ctx.publishResults = ctx.publishResults || {};

  try {
    const platforms = [];

    if (ctx.linkedin?.finalCaption && ctx.linkedinPostDbId) {
      platforms.push(publishLinkedIn(ctx));
    }
    if (ctx.instagram?.finalCaption && ctx.instagramPostDbId) {
      platforms.push(publishInstagram(ctx));
    }
    if (ctx.tiktok?.finalCaption && ctx.tiktokPostDbId) {
      platforms.push(publishTikTok(ctx));
    }

    await Promise.allSettled(platforms);

    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.publisher = { startedAt, finishedAt: Date.now(), results: ctx.publishResults };
  } catch (err) {
    ctx.errors = ctx.errors || [];
    ctx.errors.push({ agent: 'publisher', error: err.message });
    ctx.agentLog = ctx.agentLog || {};
    ctx.agentLog.publisher = { startedAt, finishedAt: Date.now(), error: err.message };
  }
}

// ── LinkedIn UGC API ────────────────────────────────────────────────────────

async function publishLinkedIn(ctx) {
  try {
    const accessToken = await getSecret('LINKEDIN_ACCESS_TOKEN');
    if (!accessToken) {
      ctx.publishResults.linkedin = { success: false, error: 'No access token' };
      return;
    }

    // Get user URN
    const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) throw new Error(`LinkedIn /userinfo failed: ${meRes.status}`);
    const me = await meRes.json();
    const authorUrn = `urn:li:person:${me.sub}`;

    const body = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: ctx.linkedin.finalCaption },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      throw new Error(`LinkedIn publish failed: ${postRes.status} — ${errText}`);
    }

    const postId = postRes.headers.get('x-restli-id');
    await updatePost(ctx.linkedinPostDbId, {
      status: 'published',
      published_at: new Date().toISOString(),
      published_id: postId,
    });

    ctx.publishResults.linkedin = { success: true, postId };
  } catch (err) {
    ctx.publishResults.linkedin = { success: false, error: err.message };
    await updatePost(ctx.linkedinPostDbId, { status: 'failed' }).catch(() => {});
  }
}

// ── Instagram Graph API ─────────────────────────────────────────────────────

async function publishInstagram(ctx) {
  try {
    const accessToken = await getSecret('INSTAGRAM_ACCESS_TOKEN');
    if (!accessToken) {
      ctx.publishResults.instagram = { success: false, error: 'No access token' };
      return;
    }

    // For now, text-only posts (image uploads require public URL or container flow)
    const caption = ctx.instagram.finalCaption;

    // Step 1: Get Instagram Business Account ID
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account&access_token=${accessToken}`
    );
    const accountsData = await accountsRes.json();
    const igAccountId = accountsData?.data?.[0]?.instagram_business_account?.id;

    if (!igAccountId) {
      throw new Error('No Instagram Business Account found');
    }

    // Step 2: Create media container (image post if we have image_url)
    const containerParams = new URLSearchParams({
      caption,
      access_token: accessToken,
    });

    if (ctx.instagram.imageUrl && !ctx.instagram.imageUrl.startsWith('data:')) {
      containerParams.set('image_url', ctx.instagram.imageUrl);
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media`,
      { method: 'POST', body: containerParams }
    );
    const containerData = await containerRes.json();

    if (!containerData.id) {
      throw new Error(`Instagram container creation failed: ${JSON.stringify(containerData)}`);
    }

    // Step 3: Publish container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
      {
        method: 'POST',
        body: new URLSearchParams({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      }
    );
    const publishData = await publishRes.json();

    if (!publishData.id) {
      throw new Error(`Instagram publish failed: ${JSON.stringify(publishData)}`);
    }

    await updatePost(ctx.instagramPostDbId, {
      status: 'published',
      published_at: new Date().toISOString(),
      published_id: publishData.id,
    });

    ctx.publishResults.instagram = { success: true, postId: publishData.id };
  } catch (err) {
    ctx.publishResults.instagram = { success: false, error: err.message };
    await updatePost(ctx.instagramPostDbId, { status: 'failed' }).catch(() => {});
  }
}

// ── TikTok Content Posting API ──────────────────────────────────────────────

async function publishTikTok(ctx) {
  try {
    const accessToken = await getSecret('TIKTOK_ACCESS_TOKEN');
    if (!accessToken) {
      ctx.publishResults.tiktok = { success: false, error: 'No access token' };
      return;
    }

    // TikTok API v2 — Content Posting (text post / photo post)
    const caption = ctx.tiktok.finalCaption;

    const body = {
      post_info: {
        title: caption.slice(0, 150),
        description: caption,
        privacy_level: 'PUBLIC_TO_EVERYONE',
      },
      source_info: {
        source: 'PULL_FROM_URL',
      },
    };

    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.error?.code) {
      throw new Error(`TikTok publish failed: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const publishId = data.data?.publish_id;
    await updatePost(ctx.tiktokPostDbId, {
      status: 'published',
      published_at: new Date().toISOString(),
      published_id: publishId || 'unknown',
    });

    ctx.publishResults.tiktok = { success: true, publishId };
  } catch (err) {
    ctx.publishResults.tiktok = { success: false, error: err.message };
    await updatePost(ctx.tiktokPostDbId, { status: 'failed' }).catch(() => {});
  }
}

module.exports = { publish };
