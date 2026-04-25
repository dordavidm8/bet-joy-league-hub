# KickOff Social Agents — Project Handoff

> מסמך העברה לכלי פיתוח אחר. כולל את המצב הנוכחי, ההחלטות שהתקבלו, והתוכנית המלאה.

---

## 1. רקע הפרויקט

**KickOff** — פלטפורמת הימורי כדורגל חברתית ישראלית (React + TypeScript + TanStack Query קדמי, Node.js/Express + PostgreSQL אחורי, strict CommonJS).

**המטרה:** מערכת סוכני AI אוטונומית לניהול שיווק הסושיאל (LinkedIn, Instagram, TikTok) בסגנון NoimosAI, עם אייג'נטים מבוססי Claude Agent Skills (SKILL.md בהשראת [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)) ודפוסי orchestration בהשראת [paperclipai/paperclip](https://github.com/paperclipai/paperclip).

**שפה:** כל ה-UI בעברית, RTL, פונט Rubik. פרומפטים בעברית, hashtags באנגלית.

---

## 2. מצב נוכחי (מה כבר קיים)

### Backend — [backend/src/agents/](backend/src/agents/)

המערכת רצה כעת על הליבה החדשה (V2). כל קוד ה-V1 המונוליטי הוסר.

| רכיב | תפקיד | מצב |
|---|---|---|
| `kernel/orchestrator.js` | Pipeline controller + flow logic | ✅ פעיל |
| `kernel/taskRunner.js` | Groq execution (Llama 3.3 70B) + Retry | ✅ פעיל |
| `kernel/skillLoader.js` | YAML SKILL.md parser | ✅ פעיל |
| `kernel/eventBus.js` | Real-time DB & SSE logger | ✅ פעיל |
| `tools/groqClient.js` | SDK wrapper + usage tracking | ✅ פעיל |
| `skills/` | Directory containing active skill folders | ✅ פעיל |

### Frontend — [src/components/admin/social/v2/](src/components/admin/social/v2/)

ממשק הניהול החדש (V2) הוא כעת הממשק היחיד הפעיל עבור סושיאל מדיה.

| קובץ | תפקיד | מצב |
|---|---|---|
| `SocialAgentsV2Tab.tsx` | Main Dashboard | ✅ פעיל |
| `panels/DraftsInbox.tsx` | UI להצגת טיוטות מ-`social_posts` | ✅ פעיל |
| `panels/PipelineTimeline.tsx` | מעקב SSE אחרי ריצות חיות | ✅ פעיל |
| `hooks/useDrafts.ts` | Hook המחובר ל-`/api/agents/posts` | ✅ פעיל |

### Database — 10 טבלאות קיימות

קובץ migration: [backend/src/db/migrations/2026_social_media_agents.sql](backend/src/db/migrations/2026_social_media_agents.sql)

| טבלה | תפקיד |
|---|---|
| `social_pipeline_runs` | ריצות pipeline + audit |
| `social_posts` | פוסטים (pending/approved/published/rejected) + A/B groups |
| `social_agent_config` | enabled, auto_approve, posting_time, model, daily_limit, learned_rules |
| `social_knowledge_base` | KB entries (brand voice, facts) |
| `social_memory` | Unified memory (ranked facts from 30-day analytics) |
| `social_analytics` | Engagement, reach, CTR per post |
| `social_competitor_insights` | Competitor posts + analysis |
| `social_brand_voice` | Tone, style guide |
| `social_listening_alerts` | PR risks, mentions |
| `social_oauth_tokens` | Encrypted platform tokens |

### Cron jobs — [backend/src/jobs/](backend/src/jobs/)

- `socialMediaPost.js` — 08:00 IST יומי (מעודכן ל-V2)
- `socialListening.js` — כל 4 שעות
- `socialAnalytics.js` — 11:00 IST יומי

### API Routes — [backend/src/routes/agentsV2.js](backend/src/routes/agentsV2.js)

---

## 3. ההחלטות שהתקבלו

סוכמו לאחר שיחה עם המשתמש:

| נושא | החלטה |
|---|---|
| **היקף** | בנייה מחדש מלאה — מחיקת `backend/src/services/social/` הישן |
| **DB** | שומרים את כל 10 הטבלאות הקיימות, רק מחברים אייג'נטים חדשים אליהן |
| **אלמנטי UI** | Agent Cards Dashboard + Chat Interface + Real-time Pipeline View (ללא Content Calendar) |
| **מקורות תוכן** | Reddit API (חינם) + RSS חינמיים (ynet/sport5/ONE) + ניתוח מתחרים. **ללא APIs בתשלום** |
| **פרסום** | Draft-only — כפתורי "העתק" לפלטפורמה, ללא OAuth ופרסום אוטומטי |
| **מסגרת זמן** | MVP תוך 4 ימים, ואז איטרציות שבועיות |
| **פורמט אייג'נטים** | Claude Agent Skills — `SKILL.md` עם YAML frontmatter + `references/*.md` (בהשראת coreyhaines31/marketingskills) |
| **ארכיטקטורת orchestration** | Kernel עצמי (3 קבצים קטנים) בהשראת paperclip. **paperclip עצמו נבדק ונפסל** — pure ESM, אפליקציית monorepo שלמה ללא SDK, מריץ Claude Code CLI כ-subprocess במקום Groq/Gemini — לא מתאים להטמעה בתוך KickOff |
| **שפה** | עברית RTL, hashtags באנגלית |
| **עיצוב** | Dark theme (bg-slate-950), accent כחול-סגול, Rubik, בסגנון NoimosAI (ללא גישה לסקרינים) |

---

## 4. פיצ'רי NoimosAI שצריך להבטיח

### 4.1 מערך אייג'נטים מומחים (6 אייג'נטים)

1. **Research Agent** — סריקה מתמדת של הרשת (אתרים, רשתות, מאמרים), זיהוי טרנדים והזדמנויות
2. **SEO/GEO Agent** — אופטימיזציה למנועי חיפוש קלאסיים (Google) וג'נרטיביים (Perplexity, SearchGPT)
3. **Creative/Content Agent** — יצירת נכסים ויזואליים וטקסטואליים עם Tone of Voice
4. **Social Media Agent** — תזמון, תגובה לעוקבים, ניתוח engagement
5. **Outreach Agent** — פודקאסטים, כתבות, קשרי יח"צ, לידים קרים [Phase 2]
6. **Strategy Agent ("המוח")** — מחבר בין כולם, ROI, שינוי כיוון

### 4.2 אוטונומיה 24/7

- **Unified Memory** — לומד את קול המותג ומעדיף את המשתמש ככל שמשתמשים יותר (כבר קיים, לשלב)
- **Social Listening** — סריקת רשת לאזכורי מותג, זיהוי לידים, מניעת משברי יח"צ (קיים חלקית)
- **Unsupervised execution** — Draft-only בשלב MVP, פרסום אוטומטי ב-Phase 2

### 4.3 ניהול ובקרה ("לוח פיקוד")

- **Live Work Feed** — כל פעולות האייג'נטים בזמן אמת עם כפתורי אישור/עריכה/דחייה
- **Management Chat** — הקצאת משימות ב-natural language
- **Knowledge Base** — העלאת מסמכים ונתוני חברה (קיים ב-DB)

### 4.4 יצירת תוכן מתקדמת

- **Magic Switch** — פוסט אחד → סדרת תוצרים (Reels, קרוסלות, ציוצים) בלחיצה (קיים כ-MagicSwitchModal)
- **טקסט לווידאו** — NotebookLM + FFmpeg [Phase 2]

### 4.5 אבטחה ואינטגרציות

- נתונים פרטיים, לא מאומנים למודלים ציבוריים
- אינטגרציות עתידיות: אנליטיקס, CRM, Google Ads [Phase 2]

---

## 5. ארכיטקטורה חדשה

### 5.1 מבנה Backend

> **עדכון החלטה (2026-04-25):** paperclip נבדק ונפסל (ESM-only, אפליקציית monorepo ללא SDK, spawns Claude Code CLI). במקום זאת — kernel עצמי קטן שמממש 4 יכולות: atomic task checkout (Postgres `SELECT FOR UPDATE SKIP LOCKED`), event bus (EventEmitter → SSE), budget tracking (token counter ב-ctx), memory loop (כבר קיים ב-`social_memory`).

```
backend/src/agents/
├── kernel/
│   ├── orchestrator.js       # Sequential/parallel stage runner, atomic checkout, SSE broadcast
│   ├── eventBus.js           # EventEmitter — stage events מוזרמים גם ל-DB (agent_events) וגם ל-SSE
│   ├── taskRunner.js         # Retry, timeout, budget tracking per task
│   ├── budget.js             # Token/cost counter — מקבל tokens_in/out מ-Groq/Gemini, מעדכן agent_tasks
│   ├── skillLoader.js        # טוען SKILL.md + references/*.md + YAML frontmatter parser
│   └── toolRegistry.js       # רישום כלים (reddit, rssFeeds, groq, imageGen, memory, kb)
│
├── skills/                   # כל אייג'נט = תיקייה עם SKILL.md (פורמט coreyhaines31/marketingskills)
│   ├── research-agent/
│   │   ├── SKILL.md          # YAML frontmatter: name, description, metadata.version; body: instructions
│   │   └── references/
│   │       ├── sources.md    # רשימת RSS feeds + subreddits
│   │       ├── relevance.md  # איך לדרג חדשות לפי רלוונטיות ל-KickOff
│   │       └── examples.md   # דוגמאות briefs טובים/רעים
│   │
│   ├── seo-geo-agent/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── hashtags.md   # איך לבחור hashtags לכל פלטפורמה
│   │       ├── geo.md        # Generative Engine Optimization guide
│   │       └── hebrew-seo.md # SEO ספציפי לעברית
│   │
│   ├── creative-content-agent/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── linkedin.md   # הוראות + schema JSON (150-300 מילים, טון מקצועי)
│   │       ├── instagram.md  # קצר וקליט, עד 100 מילים
│   │       ├── tiktok.md     # 15-30 שניות, hook, overlay, CTA
│   │       ├── tone-guide.md # Tone of Voice של KickOff
│   │       └── visual.md     # הוראות ל-image prompts (Imagen 3)
│   │
│   ├── social-media-agent/   # תזמון, תגובות, engagement analysis
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── scheduling.md
│   │       └── engagement.md
│   │
│   ├── outreach-agent/       # Phase 2
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── podcasts.md
│   │       └── outreach-templates.md
│   │
│   ├── strategy-agent/       # "המוח" — מחבר בין כולם
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── weekly-theme.md
│   │       ├── content-angle.md
│   │       └── kpis.md
│   │
│   ├── competitor-agent/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── competitors.md  # Winner, 888, Pari — מה לעקוב
│   │       └── analysis.md
│   │
│   └── draft-packager/
│       ├── SKILL.md
│       └── references/
│           └── formats.md    # פורמט לכל פלטפורמה (LI composer, IG caption, TikTok description)
│
├── tools/
│   ├── reddit.js             # snoowrap או fetch ישיר (r/soccer, r/sportsbook, r/israelsports)
│   ├── rssFeeds.js           # rss-parser (ynet sport, sport5, ONE, Walla sport)
│   ├── groqClient.js         # Groq SDK wrapper (llama-3.3-70b-versatile)
│   ├── imageGen.js           # Imagen 3 wrapper (imagen-3.0-generate-002)
│   ├── memoryStore.js        # שאילתות unified_memory + social_memory
│   └── knowledgeBase.js      # שאילתות social_knowledge_base
│
└── index.js                  # Entry — רישום skills ב-roster, חיווט routes
```

### 5.2 פורמט SKILL.md (חובה לכל אייג'נט)

```markdown
---
name: research-agent
description: סורק את הרשת (Reddit, RSS ישראליים) ומזהה טרנדים + הזדמנויות בזמן אמת עבור KickOff
metadata:
  version: 1.0.0
  role: Research
  title: סוכן מחקר
  avatar: 🔍
  tools: [reddit, rssFeeds, memoryStore]
---

# Research Agent

## Instructions

אתה סוכן מחקר של KickOff. המשימה שלך: לסרוק מקורות מידע ציבוריים ולזהות 3-5 נושאים חמים שיעניינו את הקהל הישראלי של חובבי כדורגל והימורים.

## Process

1. קרא ל-`reddit.getTop('r/soccer', '24h')` ו-`reddit.getTop('r/israelsports', '24h')`
2. קרא ל-`rssFeeds.fetch(['ynet_sport', 'sport5', 'one'])`
3. סנן לפי רלוונטיות (ראה [references/relevance.md](references/relevance.md))
4. החזר מערך של topic briefs בפורמט:
   ```json
   [{
     "headline": "...",
     "source": "ynet_sport",
     "url": "https://...",
     "summary": "...",
     "relevance_score": 0.85
   }]
   ```

## References
- [sources.md](references/sources.md) — רשימת מקורות
- [relevance.md](references/relevance.md) — מדד רלוונטיות
- [examples.md](references/examples.md) — דוגמאות
```

### 5.3 טבלאות DB חדשות

קובץ: `backend/src/db/migrations/2026C_agents_v2.sql`

```sql
CREATE TABLE agent_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(50),
  title VARCHAR(100),
  avatar VARCHAR(10),
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES social_pipeline_runs(id) ON DELETE CASCADE,
  skill_name VARCHAR(100) REFERENCES agent_roster(skill_name),
  stage VARCHAR(50),
  status VARCHAR(20),         -- queued | running | success | failed
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE agent_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID REFERENCES social_pipeline_runs(id) ON DELETE CASCADE,
  skill_name VARCHAR(100),
  event_type VARCHAR(50),     -- stage_started | stage_completed | stage_failed | log | tool_call
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_tasks_run ON agent_tasks(run_id);
CREATE INDEX idx_agent_events_run ON agent_events(run_id);

-- Seed roster
INSERT INTO agent_roster (skill_name, role, title, avatar) VALUES
  ('research-agent', 'Research', 'סוכן מחקר', '🔍'),
  ('strategy-agent', 'Strategy', 'סוכן אסטרטגיה', '🧠'),
  ('creative-content-agent', 'Content', 'סוכן תוכן וקריאייטיב', '✍️'),
  ('seo-geo-agent', 'SEO', 'סוכן SEO/GEO', '📈'),
  ('social-media-agent', 'Social', 'סוכן רשתות חברתיות', '📱'),
  ('competitor-agent', 'Competitor', 'סוכן ניתוח מתחרים', '🎯'),
  ('outreach-agent', 'Outreach', 'סוכן Outreach', '🤝'),
  ('draft-packager', 'Publisher', 'אורז טיוטות', '📦');
```

### 5.4 API Routes חדשים

קובץ: `backend/src/routes/agentsV2.js`

```
GET  /api/agents/roster                   # רשימת כל האייג'נטים
POST /api/agents/runs                     # trigger ריצה חדשה
GET  /api/agents/runs/:id                 # סטטוס ריצה
GET  /api/agents/runs/:id/stream          # SSE stream של stage events
GET  /api/agents/runs/:id/tasks           # כל ה-tasks של ריצה
GET  /api/agents/drafts                   # פוסטים במצב draft_ready
POST /api/agents/chat                     # שיחה עם strategy-agent
GET  /api/agents/skills/:name             # SKILL.md + references של אייג'נט ספציפי (לצפייה ב-UI)
```

### 5.5 מבנה Frontend

```
src/components/admin/social/v2/
├── SocialAgentsV2Tab.tsx         # Top-level — 3-column layout
├── panels/
│   ├── AgentRoster.tsx           # שמאל: כרטיסי אייג'נטים (avatar, role, status, last run)
│   ├── PipelineTimeline.tsx      # מרכז עליון: SSE timeline של ריצה חיה
│   ├── AgentChat.tsx             # מרכז תחתון: chat עם strategy-agent
│   ├── DraftsInbox.tsx           # ימין: פוסטים מוכנים + כפתורי העתקה
│   ├── SkillViewer.tsx           # מודאל — הצג SKILL.md + references של אייג'נט
│   └── LiveWorkFeed.tsx          # גרסה משופרת של הקיים
├── hooks/
│   ├── useAgentRunStream.ts      # EventSource → pipeline updates
│   ├── useAgentRoster.ts         # TanStack Query
│   └── useDrafts.ts              # שאילתת social_posts WHERE status='draft_ready'
└── ui/
    ├── AgentCard.tsx             # כרטיס אייג'נט עם avatar, status dot, metrics
    ├── StageNode.tsx             # צומת ב-timeline (running/success/failed)
    └── CopyButton.tsx            # כפתור העתקה לפלטפורמה + פתיחת composer
```

---

## 6. 4 ימי MVP

### יום 1 — Kernel + DB + Routes

- Migration `2026C_agents_v2.sql` עם 3 טבלאות + seed של 8 אייג'נטים
- `kernel/eventBus.js` — EventEmitter, מפרסם ל-SSE ושומר ל-`agent_events`
- `kernel/taskRunner.js` — wrap אייג'נט בודד: מתחיל `agent_tasks` row, retry+timeout, סוגר עם status+output+error
- `kernel/orchestrator.js` — מריץ רצף של stages, atomic checkout דרך Postgres transaction
- `kernel/budget.js` — counter tokens_in/out, מעדכן `agent_tasks.output.budget`
- `kernel/skillLoader.js` — פרסר YAML frontmatter (`js-yaml`) + קריאת references
- `kernel/toolRegistry.js` — map של tool name → function
- `backend/src/routes/agentsV2.js` עם 8 endpoints כולל SSE (`GET /runs/:id/stream`)
- חיווט ב-[backend/src/app.js](backend/src/app.js): `/api/agents` → agentsV2
- Smoke test: POST `/api/agents/runs` מריץ "hello world" skill, SSE מחזיר stage_started+stage_completed, `agent_tasks` מעודכן

### יום 2 — Skills (8 אייג'נטים)

**גישה: 4 core end-to-end קודם, אז להרחיב.**

- בוקר: 4 אייג'נטים מרכזיים בריצה שלמה — `research-agent` → `strategy-agent` → `creative-content-agent` → `draft-packager`
- ודא ש-pipeline מלא רץ end-to-end: trigger → 4 stages → drafts ב-`social_posts` עם `status='draft_ready'`
- אחה"צ: הוסף `seo-geo-agent` + `competitor-agent` + `social-media-agent`
- דחיית `outreach-agent` ל-Phase 2
- **מקורות תוכן ב-MVP: RSS בלבד** (`ynet sport`, `sport5`, `ONE`, `Walla sport`). Reddit נדחה ל-Phase 1.5
- כלים ל-MVP: `tools/rssFeeds.js`, `tools/groqClient.js`, `tools/imageGen.js`, `tools/memoryStore.js`, `tools/knowledgeBase.js`
- כלים דחויים: `tools/reddit.js` (כשיהיו credentials)

### יום 3 — UI

- `SocialAgentsV2Tab.tsx` עם 3-column layout
- `AgentRoster.tsx` + `AgentCard.tsx` — רשת של 8 כרטיסים
- `PipelineTimeline.tsx` + `StageNode.tsx` — SSE stream
- `AgentChat.tsx` — ממחזר את [ManagementChat.tsx](src/components/admin/social/ManagementChat.tsx)
- `DraftsInbox.tsx` + `CopyButton.tsx` — clipboard API + deep links לפלטפורמות
- טאב חדש ב-[AdminDashboard.tsx](src/pages/AdminDashboard.tsx): "סוכני סושיאל v2"

### יום 4 — Integration + Cleanup

**עד יום 4 הקוד הישן רץ במקביל** — `socialMediaPost.js` cron + `socialMedia.js` routes ממשיכים לפעול כרשת ביטחון. אל תשבית כלום עד שה-v2 עבר e2e.

- בדיקות e2e: trigger run → SSE מעדכן timeline → drafts מופיעים → העתקה לקליפבורד
- השבתה: בטל את cron הישן (`socialMediaPost.js`) רק לאחר שה-v2 הריץ ריצה מוצלחת מלאה
- מחיקה: `backend/src/services/social/` (שומרים `socialMediaUtils.js` → עובר ל-`agents/tools/`)
- מחיקה: [SocialAgentTab.tsx](src/components/admin/SocialAgentTab.tsx) + 7 sub-tabs הישנים (שומרים MagicSwitchModal, KnowledgeBaseManager)
- עדכון SOCIAL_AGENTS_PROJECT.md

---

## 7. Tools & Access

### מוגדר כבר (ב-ALLOWED_KEYS)
- `GROQ_API_KEY` — Agent brain
- `GEMINI_API_KEY` — Imagen 3
- `SERPER_API_KEY` — קיים אך לא יעשה בו שימוש ב-MVP

### צריך להוסיף (חינם)
- `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` — Reddit OAuth app (https://www.reddit.com/prefs/apps)
- להוסיף ל-ALLOWED_KEYS ב-[backend/src/routes/admin.js](backend/src/routes/admin.js)

### NPM packages חדשים
- `rss-parser` — RSS feeds
- `snoowrap` — Reddit client (או fetch ישיר אם רוצים פחות dependencies)

### לא נעשה בהם שימוש ב-MVP
- Firecrawl, Apify, Tavily (בתשלום)
- LinkedIn/IG/TikTok OAuth (Draft-only)
- Supabase Storage / S3 (תמונות נשארות base64 ב-DB)

---

## 8. Verification (Acceptance Criteria)

### MVP נחשב מוכן כש:

1. `psql -f 2026C_agents_v2.sql` רץ בהצלחה, `SELECT COUNT(*) FROM agent_roster` = 8
2. `GET /api/agents/roster` מחזיר JSON עם 8 אייג'נטים
3. `POST /api/agents/runs` מתחיל ריצה, SSE משדר stage events
4. `SELECT caption FROM social_posts WHERE status='draft_ready'` ≥ 6 (3 פלטפורמות × 2 A/B)
5. כל פוסט עם `image_url` (base64 בינתיים) ו-`final_caption`
6. UI: טאב "סוכני סושיאל v2" נטען, 8 כרטיסי אייג'נט, כפתור "הפעל Pipeline" מציג timeline בזמן אמת
7. DraftsInbox: כפתור "העתק ל-LinkedIn" → clipboard מכיל caption + hashtags
8. `ls backend/src/services/social/` — רק `socialMediaUtils.js` (או ריק אם הועבר)
9. כל אייג'נט עם `SKILL.md` תקין (YAML frontmatter + body + references)
10. אפשר לצפות ב-SKILL.md של אייג'נט דרך ה-UI (`SkillViewer.tsx`)

---

## 9. Phase 2 (אחרי MVP)

לפי סדר עדיפות:

1. **OAuth** לכל שלוש הפלטפורמות — LinkedIn UGC, Facebook Login (IG Graph), TikTok Content Posting
2. **Cloud storage** לתמונות (Supabase Storage) — במקום base64
3. **Outreach Agent** — פודקאסטים, כתבות, לידים קרים
4. **Rejection Feedback Loop** — טבלת `social_post_feedback`, `regenerateWithFeedback`, `learned_rules` ב-config, cron יומי
5. **Video Generation** — NotebookLM + FFmpeg (קיים ב-`notebookLmService.js` אך לא מחובר)
6. **Magic Switch מלא** — פוסט אחד → סדרת תוצרים (Reels, carousel, ציוצים)
7. **Performance Dashboard** — גרפים של engagement, reach, follower growth
8. **A/B Testing Framework** — השוואת וריאנטים אמיתיים עם metrics
9. **WhatsApp distribution** — שליחת פוסטים דרך whatsapp-bot הקיים
10. **Serper/Firecrawl/Apify integration** — העמקת מקורות תוכן (כשיש תקציב)

---

## 10. סיכונים ונקודות פתוחות

| סיכון | מיטיגציה |
|---|---|
| Reddit + RSS לבד = briefs רדודים | אם יוצא תוכן חלש אחרי יום 2 — נוסיף Tavily (free tier) |
| SSE דרך nginx דורש `X-Accel-Buffering: no` | לבדוק deploy config |
| base64 images ב-DB — מוגבל ב-row size | מגבלה זמנית, Supabase Storage ב-Phase 2 |
| 4 ימים זה צפוף | ה-MVP מצומצם ב-feature-set, ולא בחוסר איכות |
| Groq rate limits | שימוש בטמפ' נמוכה + backoff ב-`taskRunner.js` |

---

## 11. קישורים חיוניים

- **הרפו של KickOff:** https://github.com/dordavidm8/bet-joy-league-hub
- **Claude Skills reference:** https://github.com/coreyhaines31/marketingskills
- **paperclip orchestration:** https://github.com/paperclipai/paperclip
- **NoimosAI** (למטרות השראה ויזואלית בלבד, ללא גישה API)
- **קובץ פרויקט קודם:** [SOCIAL_AGENTS_PROJECT.md](SOCIAL_AGENTS_PROJECT.md)

---

## 12. הוראות להמשך פיתוח בכלי אחר

1. העתק את המסמך הזה לשורש הפרויקט כ-`AGENTS_V2_HANDOFF.md`
2. קרא את הקבצים הקיימים ב-[backend/src/services/social/](backend/src/services/social/) לפני המחיקה — במיוחד `visualCreatorAgent.js` (Imagen 3 logic) ו-`socialMediaUtils.js` (Groq/Gemini clients)
3. התחל מ-**יום 1** (Kernel + Migration) — אל תקפוץ ל-UI לפני שה-backend עובד
4. בנה אייג'נט אחד ב-**יום 2**, ודא שהוא עובד end-to-end, ואז שכפל לשאר
5. אל תמחק את הקוד הישן לפני יום 4 — הוא רשת ביטחון
6. וודא שהוספת את `REDDIT_CLIENT_ID` ו-`REDDIT_CLIENT_SECRET` ל-ALLOWED_KEYS לפני יום 2
7. פורמט SKILL.md — העתק בדיוק את המבנה מ-coreyhaines31/marketingskills; כל סטייה תשבור את ה-skillLoader
