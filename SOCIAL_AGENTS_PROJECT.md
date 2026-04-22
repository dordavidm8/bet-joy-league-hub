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
 Ongoing ─────► Management Chat (Groq with tools)
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

---

## Phase 1 — Core Infrastructure ✅ COMPLETED

### Database
- [x] `backend/src/db/migrations/2026_social_media_agents.sql` — 10 tables

### Backend Services
- [x] `backend/src/services/social/socialMediaUtils.js` — Groq + Gemini clients, DB ops, helpers
- [x] `backend/src/services/social/contentCalendarAgent.js` — Weekly theme + weekly cache
- [x] `backend/src/services/social/growthStrategyAgent.js` — Content angle from app stats
- [x] `backend/src/services/social/contentCreatorAgent.js` — 3× parallel Groq calls (LI/IG/TT)
- [x] `backend/src/services/social/seoGeoAgent.js` — Hashtags + GEO optimization
- [x] `backend/src/services/social/promptLibraryService.js` — Nano Banana Pro template selector (6 categories, 115 templates)
- [x] `backend/src/services/social/visualCreatorAgent.js` — Groq picks best template → Gemini Imagen 3
- [x] `backend/src/services/social/publisherAgent.js` — LinkedIn UGC + Instagram Graph + TikTok APIs
- [x] `backend/src/services/social/orchestratorAgent.js` — Full pipeline orchestration + idempotency
- [x] `backend/src/services/social/nano-banana-templates.json` — 115 curated prompt templates (361KB)
- [x] `backend/src/services/social/extract_prompt_templates.py` — One-time Python extractor (25MB CSV → JSON)

### Cron Jobs
- [x] `backend/src/jobs/socialMediaPost.js` — Daily pipeline entry point
- [x] `backend/src/jobs/socialListening.js` — Serper → Groq sentiment, PR risk alerts
- [x] `backend/src/jobs/socialAnalytics.js` — LinkedIn/Instagram/TikTok analytics refresh

### API Routes (`/api/social/*`)
- [x] `backend/src/routes/socialMedia.js` — 20+ endpoints:
  - `GET/POST /runs` — pipeline history + manual trigger
  - `GET /posts` + `GET /posts/:id` — post listing
  - `POST /posts/:id/approve` + `/reject` — approval flow
  - `PUT /posts/:id` — content editing
  - `GET /analytics/overview` — aggregate stats
  - `GET/POST/PUT/DELETE /knowledge-base` — KB CRUD
  - `GET /competitor/posts` + `GET /mentions` — listening
  - `GET/PATCH /config` — agent configuration
  - `GET/POST /chat` — management chat
  - `POST /magic-switch` — content format converter
  - `GET /status` — system health

### Wiring
- [x] `backend/src/app.js` — `/api/social` registered
- [x] `backend/src/jobs/index.js` — 4 cron schedules added (07:30, 08:00, 11:00, every 4h IST)
- [x] `backend/src/routes/admin.js` — 6 new keys in ALLOWED_KEYS + ENV_KEYS
- [x] `backend/package.json` — `@anthropic-ai/sdk`, `@google/genai` added (groq-sdk was already present)

### Nano Banana Pro Integration
- [x] Extracted 11,919 prompts from CSV → 115 best templates in 6 categories:
  - `sports_content` — Football/sports scenes (top: "AI Footballer Goal Celebration")
  - `social_media_post` — Lifestyle/editorial (top: "Ultra-Photorealistic Viral Mirror Selfie")
  - `infographic` — Data/educational visuals
  - `poster_flyer` — Product shots, brand posters
  - `profile_avatar` — Character/avatar art
  - `default` — Best overall (top: "Playful Selfie with Lionel Messi in Stadium")
- [x] Groq selects **best template** per platform + adapts it for KickOff brand
- [x] Raw CSV (25MB) gitignored; compiled JSON (361KB) committed

---

## Phase 2 — Advanced Agents & Frontend 🚧 IN PROGRESS

### Advanced Backend Agents
- [ ] `backend/src/services/social/unifiedMemoryService.js` — 30-day analytics → memory insights
- [ ] `backend/src/services/social/managementChatAgent.js` — Groq with tool-calling
- [ ] `backend/src/services/social/competitorAgent.js` — Serper → Groq competitor analysis
- [ ] `backend/src/services/social/analyticsAgent.js` — Deep performance analysis

### Frontend Components
- [ ] `src/components/admin/social/SocialAgentDashboard.tsx` — Main layout + tabs
- [ ] `src/components/admin/social/LiveWorkFeed.tsx` — Approve/reject/edit cards
- [ ] `src/components/admin/social/AgentStatusGrid.tsx` — Agent status cards
- [ ] `src/components/admin/social/ManagementChat.tsx` — Chat UI
- [ ] `src/components/admin/social/PostHistoryGallery.tsx` — Post grid
- [ ] `src/components/admin/social/KnowledgeBaseManager.tsx` — KB CRUD
- [ ] `src/components/admin/social/CompetitorBoard.tsx` — Competitor posts
- [ ] `src/components/admin/social/SocialListeningFeed.tsx` — Mentions feed
- [ ] `src/components/admin/social/MagicSwitchPanel.tsx` — Content converter
- [ ] `src/components/admin/social/AgentConfigModal.tsx` — Settings
- [ ] Update `src/pages/AdminDashboard.tsx` — Add "סוכני סושיאל 🤖" tab

---

## Config Keys Added to Admin Dashboard
```
GROQ_API_KEY          ← Agent brain (already existed)
GEMINI_API_KEY        ← Imagen 3 image generation
LINKEDIN_ACCESS_TOKEN ← LinkedIn UGC API
INSTAGRAM_ACCESS_TOKEN← Instagram Graph API
TIKTOK_ACCESS_TOKEN   ← TikTok Content Posting API
SERPER_API_KEY        ← Social listening / web search
```

## Social Agent Config (manageable via /api/social/config)
| Key | Default | Description |
|---|---|---|
| `enabled` | `false` | Master on/off switch |
| `auto_approve` | `false` | Auto-publish without human review |
| `posting_time` | `08:00` | Daily pipeline time (IST) |
| `model` | `llama-3.3-70b-versatile` | Groq model |
| `brand_voice` | Hebrew | KickOff brand personality |
| `linkedin_enabled` | `true` | Per-platform toggle |
| `instagram_enabled` | `true` | Per-platform toggle |
| `tiktok_enabled` | `true` | Per-platform toggle |
| `daily_limit` | `3` | Max posts per day |
