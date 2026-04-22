# Social Media Agents — Project Tracker

## Overview
מערכת אייגנטים אוטונומית לניהול סושיאל מדיה של KickOff,
בסגנון NoimosAI, מבוססת **Groq LLM** (llama-3.3-70b-versatile) + Gemini Imagen 3.

---

## Architecture

```
                ┌──────────────────────────────────────────────────┐
 07:30 IST ───► │  Growth Strategy Agent  │  App stats + trends   │
                └───────────┬──────────────────────────────────────┘
                            ▼
 08:00 IST ───► ┌──────────────────────────────────────────────────┐
                │            ORCHESTRATOR (orchestratorAgent.js)   │
                │  1. Content Calendar (weekly theme, cached)      │
                │  2. Growth Strategy (content angle from DB)      │
                │  3. Content Creator (3× Groq → LI + IG + TT)    │
                │  4. Prompt Library (Nano Banana Pro selector)    │
                │  5. Visual Creator (Groq adapts → Imagen 3)      │
                │  6. SEO/GEO (hashtags + AI search content)       │
                │  7. Save posts as pending_approval               │
                │  8. Auto-publish if config.auto_approve = true   │
                └──────────────────────────────────────────────────┘
                            ▼
                ┌──────────────────────────────────────────────────┐
                │  Admin Dashboard → Approve / Reject / Edit       │
                └───────────┬──────────────────────────────────────┘
                            ▼
                ┌──────────────────────────────────────────────────┐
                │  Publisher Agent → LinkedIn + Instagram + TikTok  │
                └──────────────────────────────────────────────────┘

 Every 4h ────► Social Listening (Serper + Groq sentiment)
 11:00 IST ──► Analytics Refresh (platform APIs → DB)
```

---

## Tech Stack
| Component | Tech |
|---|---|
| Agent Brain | **Groq** `llama-3.3-70b-versatile` via `groq-sdk` |
| Visuals | **Gemini Imagen 3** (`imagen-3.0-generate-002`) |
| Prompt Templates | **Nano Banana Pro** (11,919 prompts → 115 curated) |
| Backend | Node.js/Express — strict **CommonJS** |
| DB | PostgreSQL via `pool` from `config/database` |
| Auth | `authenticate` + `requireAdmin` middleware |
| Logging | `logAdminAction()` on all write ops |
| Frontend | React + TypeScript + TanStack Query |

---

## ✅ Phase 1 — Core Infrastructure (COMPLETED)

### Database
- [x] `backend/src/db/migrations/2026_social_media_agents.sql` — 10 tables

### Backend Services
- [x] `backend/src/services/social/socialMediaUtils.js` — **Groq** + Gemini clients, DB ops, helpers
- [x] `backend/src/services/social/contentCalendarAgent.js` — Weekly theme + weekly cache
- [x] `backend/src/services/social/growthStrategyAgent.js` — Content angle from app stats
- [x] `backend/src/services/social/contentCreatorAgent.js` — 3× parallel Groq calls (LI/IG/TT)
- [x] `backend/src/services/social/seoGeoAgent.js` — Hashtags + GEO optimization
- [x] `backend/src/services/social/promptLibraryService.js` — Nano Banana Pro selector (6 categories)
- [x] `backend/src/services/social/visualCreatorAgent.js` — Groq picks template → Gemini Imagen 3
- [x] `backend/src/services/social/publisherAgent.js` — LinkedIn UGC + Instagram Graph + TikTok APIs
- [x] `backend/src/services/social/orchestratorAgent.js` — Full pipeline orchestration + idempotency
- [x] `backend/src/services/social/nano-banana-templates.json` — 115 curated templates (361KB)
- [x] `backend/src/services/social/extract_prompt_templates.py` — One-time extractor (25MB CSV → JSON)

### Cron Jobs
- [x] `backend/src/jobs/socialMediaPost.js` — Daily pipeline entry point
- [x] `backend/src/jobs/socialListening.js` — Serper → Groq sentiment + PR risk alerts
- [x] `backend/src/jobs/socialAnalytics.js` — LinkedIn/Instagram/TikTok analytics refresh

### API Routes (`/api/social/*`)
- [x] `backend/src/routes/socialMedia.js` — 20+ endpoints (runs, posts, config, KB, chat, analytics)

### Wiring
- [x] `backend/src/app.js` — `/api/social` registered
- [x] `backend/src/jobs/index.js` — 4 cron schedules (07:30, 08:00, 11:00, every 4h IST)
- [x] `backend/src/routes/admin.js` — 6 new secret keys in ALLOWED_KEYS
- [x] `backend/package.json` — `@anthropic-ai/sdk`, `@google/genai` added

### Nano Banana Pro Integration
- [x] Groq selects best template per platform + adapts it for KickOff brand
- [x] 6 categories: `sports_content`, `social_media_post`, `infographic`, `poster_flyer`, `profile_avatar`, `default`
- [x] Raw CSV (25MB) gitignored; compiled JSON (361KB) committed

---

## ✅ Phase 2 — Frontend Dashboard (COMPLETED)

### Components
- [x] `src/components/admin/SocialAgentTab.tsx` — Main tab with 7 sub-tabs
- [x] `src/components/admin/social/LiveWorkFeed.tsx` — Approve / Reject / Edit cards + pipeline trigger
- [x] `src/components/admin/social/ManagementChat.tsx` — iMessage-style NL agent management
- [x] `src/components/admin/social/AgentStatusGrid.tsx` — Live agent cards + pipeline history
- [x] `src/components/admin/social/PostHistoryGallery.tsx` — Filtered image grid (platform/status)
- [x] `src/components/admin/social/KnowledgeBaseManager.tsx` — Full CRUD for knowledge base
- [x] `src/components/admin/social/SocialListeningFeed.tsx` — PR risk alerts + competitor feed
- [x] `src/components/admin/social/AgentConfigModal.tsx` — Toggle config + Groq model selector

### Wiring
- [x] `src/pages/AdminDashboard.tsx` — "סוכני סושיאל 🤖" tab added

---

## 🔲 Phase 3 — What's Left

### Priority: HIGH — נדרש לפני Deploy

| # | משימה | קובץ/מיקום | הערה |
|---|---|---|---|
| 1 | **הגדר API Keys בפאנל** | Admin → מתקדם → API Keys | GROQ_API_KEY, GEMINI_API_KEY, SERPER_API_KEY בשלב ראשון |
| 2 | **הרץ DB migration** | `psql -f 2026_social_media_agents.sql` | יצור את 10 הטבלאות |
| 3 | **התקן dependencies** | `npm install` בתיקיית backend | `@google/genai`, `@anthropic-ai/sdk` חדשים |
| 4 | **Manual Dry Run** | `POST /api/social/runs` עם `dryRun: true` | לוודא שהאייגנטים עובדים |

### Priority: MEDIUM — שיפורים ויכולות נוספות (COMPLETED)

| # | משימה | תיאור |
|---|---|---|
| 5 | **[x] unifiedMemoryService.js** | שירות שמסכם 30 יום של analytics להזנת הזיכרון לאייגנטים |
| 6 | **[x] managementChatAgent.js** | Groq עם Tool Calling (בדיקת DB, הפעלת pipeline, שינוי config) |
| 7 | **[x] Magic Switch Panel** | `MagicSwitchModal.tsx` — ממיר פוסט מפלטפורמה לפלטפורמה ב-1 קליק |
| 8 | **[x] analyticsAgent.js** | ניתוח ביצועים עמוק: best time to post, top hashtags, engagement rate |
| 9 | **Video support (TikTok)** | Veo 2 כשיפתח ב-API — כרגע רק thumbnail |

### Priority: LOW — Nice to Have

| # | משימה | תיאור |
|---|---|---|
| 10 | **Post Editor מלא** | עריכת caption + prompt התמונה + regenerate image בלחיצה |
| 11 | **A/B Testing** | יצירת 2 גרסאות לכל פוסט ומעקב על מי ביצע טוב יותר |
| 12 | **WhatsApp distribution** | שליחת פוסטים לกลumpot WA כמו Advisor הקיים |
| 13 | **Competitor deep analysis** | מעקב שבועי על KPIs של מתחרים + Groq insights |
| 14 | **Performance dashboard** | גרפים של engagement, reach, follower growth לאורך זמן |

---

## Config Keys (נדרש הגדרה ב-Admin)
```
GROQ_API_KEY           ← חובה | Agent brain
GEMINI_API_KEY         ← חובה | Imagen 3 visuals
SERPER_API_KEY         ← חובה | Social listening
LINKEDIN_ACCESS_TOKEN  ← אופציונלי | LinkedIn publishing
INSTAGRAM_ACCESS_TOKEN ← אופציונלי | Instagram publishing
TIKTOK_ACCESS_TOKEN    ← אופציונלי | TikTok publishing
```

## Agent Config Defaults
| Key | Default | שינוי מ-Dashboard |
|---|---|---|
| `enabled` | `false` | טאב הגדרות → הפעל מערכת |
| `auto_approve` | `false` | טאב הגדרות → פרסום אוטומטי |
| `posting_time` | `08:00` | טאב הגדרות |
| `model` | `llama-3.3-70b-versatile` | טאב הגדרות → Groq model |
| `daily_limit` | `3` | טאב הגדרות |
