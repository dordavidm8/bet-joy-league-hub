# Social Media Agents — Project Tracker (V2 finalized)

## Overview
מערכת אייגנטים אוטונומית מבוזרת מבוססת **Kernel & Skills**.
החלפה מלאה של הארכיטקטורה המונוליטית ב-V2 מבוסס **Groq LLM** (llama-3.3-70b-versatile) + איוונטים חיים ל-UI.

---

## Architecture

```
                ┌──────────────────────────────────────────────────┐
  Manual/Cron ──► │     ORCHESTRATOR (kernel/orchestrator.js)        │
                │  1. Load Skills from /agents/skills/             │
                │  2. Sequence: Research -> Strategy -> Creative -> │
                │     SEO/GEO -> Draft Packager                    │
                │  3. Task Runner executes via Groq & Tools        │
                │  4. Real-time logging to agent_events (DB)       │
                │  5. Final drafts inserted into social_posts      │
                └──────────────────────────────────────────────────┘
                            ▼
                ┌──────────────────────────────────────────────────┐
                │  Admin UI (V2) -> Approve / Reject / Edit        │
                └──────────────────────────────────────────────────┘
                            ▼
                ┌──────────────────────────────────────────────────┐
                │  Publisher Agent / Manual Upload                 │
                └──────────────────────────────────────────────────┘

 Every 4h ────► Social Listening (Serper + Groq V2)
 08:00 UTC ──► Analytics Refresh (Platform APIs -> DB)
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

## ✅ Phase 3 — V2 Decentralized Kernel (COMPLETED)

### Core Kernel (`backend/src/agents/kernel/`)
- [x] `orchestrator.js` — Sequence controller with idempotency and Context management.
- [x] `taskRunner.js` — Groq execution engine with 3-attempt retry backoff.
- [x] `skillLoader.js` — YAML parser (js-yaml) for `SKILL.md` standardization.
- [x] `eventBus.js` — EventEmitter with DB persistence for real-time UI logging.

### Skills Repository (`backend/src/agents/skills/`)
- [x] `research-agent` — Market and trend analysis.
- [x] `strategy-agent` — Content angle and platform selection.
- [x] `creative-content-agent` — Caption generation in Hebrew.
- [x] `seo-geo-agent` — Hashtag and location optimization.
- [x] `draft-packager` — JSON parser that pushes final drafts to `social_posts`.

### Database & Scaling
- [x] `agent_roster` — Capability to toggle agents on/off dynamically.
- [x] `agent_tasks` — Persistence for every step's input/output.
- [x] `agent_events` — Real-time stream data.
- [x] `social_posts` Hook — V2 now writes directly as `status='draft'`.

### V1 Cleanup
- [x] Removed all legacy code in `services/social/`.
- [x] Combined V1 and V2 UI into a unified Dashboard.
- [x] Migrated Cron Jobs (5:00 UTC) to the V2 Orchestrator.

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
| 9 | **[x] Video support (TikTok)** | שימוש באוטומציית NotebookLM Node.js + FFmpeg (תחליף ל-Veo 2) |

### Priority: LOW — Nice to Have

| # | משימה | תיאור |
|---|---|---|
| 10 | **[x] Post Editor מלא** | עריכת caption + prompt התמונה + regenerate image באמצעות Imagen 3 |
| 11 | **[x] A/B Testing** | יצירת 2 גרסאות לכל פוסט (Array) + מנגנון Grouping ו-Approval הדדי |
| 12 | **WhatsApp distribution** | שליחת פוסטים לกลumpot WA כמו Advisor הקיים |
| 13 | **[x] Competitor deep analysis**| חילוץ מסקנות עומק (Top Hooks & Action Items) באמצעות תפריט UI חדש ל־Groq |
| 14 | **[x] NotebookLM Node Script**| סקריפט אוטומציה עיוור (Playwright headless) לייצור פודקאסט שמע בלחיצה |
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
