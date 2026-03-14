
---
_2026-03-13_

## Session 2026-03-13-001: Docs Redesign + Content Accuracy

**Accomplishments:**
- Designer applied "Terminal Editorial" aesthetic to packages/docs/ — cream/amber palette, DM Serif Display + DM Sans + DM Mono font trio, rebuilt 7 landing page components, new starlight-theme.css
- BE audited all docs content against actual implementation — fixed MCP tool schemas, WebSocket event shapes, REST API routes, skill command names
- QA found and verified 7 bugs: index.mdx (deleted), installation.mdx (wrong scripts), mcp-tools.mdx (missing tools, wrong params)
- Build: 15 pages, 0 errors, 0 warnings

**Lessons:**
- Designer should create own task AND claim PM's related tasks to avoid todo leftovers
- QA ran concurrently with BE — some bug reports overlapped with fixes already in progress. QA should wait for BE/designer tasks to reach in_review before running.
- frontend-design skill was invoked by designer agent and significantly elevated design quality
- be2 reviewer pattern worked well for content accuracy verification

---
_2026-03-13_

Session 2026-03-13-002: Docs overhaul complete. Key fixes: landing page no longer shows hardcoded 7-agent roster (AgentRoster now says "Any team. Any domain." with agents.yml snippet); all 13 MDX docs translated to English; fake marketplace install commands removed from installation.mdx; Footer/Hero install scripts now consistent. Build: 15 pages, 0 errors.

---
_2026-03-14_

---
_2026-03-14_

## Session 2026-03-14-001: Dynamic Agent Composition + Multi-Server Support

**Accomplishments:**
- BE: `loadPool()` in loader.ts with fallback chain (`.relay/agents.pool.yml` → `agents.pool.yml` → `loadAgents()`); `list_pool_agents` MCP tool (no systemPrompt); `RELAY_SESSION_AGENTS_FILE` env var in `getAgents()`; `tags?: string[]` on AgentPersona/AgentConfig
- BE: Multi-server — `config.ts` with `getInstanceId()`/`getDbPath()`, auto port selection (3456–3465), CLI `--port`/`--session` args, `RELAY_DB_PATH`/`RELAY_INSTANCE` env vars
- BE: `skills/relay/SKILL.md` — Team Composition pre-flight step (conversational team selection, session-agents.yml, skip if user confirms agents.yml), multi-instance notes
- Designer: `agents.pool.example.yml` — 12 agents across web-dev (6), research (3), marketing (3), all with tags
- FE: `SessionTeamBadge`, `ServerSwitcher`, AppHeader instance label, `team:composed` WS event — all with graceful fallbacks for single-server installs
- Tests: 65 pass, 0 fail. Dashboard build: 0 errors. Docs build: 55 pages, 0 errors.
- Changeset: `.changeset/dynamic-teams-multi-server.md` — MINOR bump

**Lessons:**
- Designer agent ran concurrently with PM (good) — posted design spec before BE started implementation, FE could reference it immediately
- BE tasks 1+2 (types/loader + MCP tool) were implemented together in a single pass — efficient
- FE correctly implemented graceful fallbacks without waiting for BE to ship API changes — zero blocking
- QA prep (baseline scan, test gap analysis) during first spawn was valuable — QA immediately knew what to test on re-spawn
- Multi-server feature was mostly already env-var-driven; the main additions were DB path isolation and auto port selection


---
_2026-03-14_

_2026-03-14_

## Session 2026-03-14-002: Dashboard Enhancement

**Accomplishments:**
- FE: getAgentAccent() applied to all 6 components (pool agent color consistency fixed)
- FE: MessageFeed panel added (Slack-style, TaskBoard ↔ Messages tab in right panel, unread badge)
- FE: EventTimeline type filter (7 pill toggles: Messages/Tasks/Artifacts/Thinking/Status/Memory/Review)
- FE: TaskBoard card description 2-line clamp + hover tooltip
- FE: Reconnect UI (useRelaySocket extended with reconnecting/attempt/nextRetryIn/retryNow, offline banner)
- FE: Session replay UI (SessionReplay.tsx, GET /api/sessions dropdown, event playback controls)
- BE: session:snapshot type safety (unknown[] → concrete types, instanceId/port/agents fields added)
- BE: GET /api/sessions endpoint + getAllSessions() query (events GROUP BY session_id)
- BE: WebSocket snapshot now includes instanceId, port, agents metadata
- QA: 65/65 tests pass, dashboard build 0 errors, all 8 feature items verified

**Lessons:**
- BE completing type changes first unblocked FE type casting removal cleanly
- designer running concurrently with PM (UX spec ready before FE started) was valuable
- QA minor note: App.tsx line 184 has 1 residual `as Task[]` cast for status type narrowing — non-blocking


---
_2026-03-14_

---
_2026-03-14_

## Session 2026-03-14-003: Docs/README First-Impression Overhaul

**Team**: pm, designer, fe, marketer (new), qa

**Accomplishments:**
- Marketer (new agent): README install commands fixed (stale `/plugin marketplace add` → `claude mcp add`); landing.ts Hero CTA sharpened, HowItWorks/Features copy improved (EN+KO); introduction.mdx + quick-start.mdx full rewrite (EN+KO)
- Designer: full audit of docs/README, posted design spec with P0 bug finding (AgentRoster `persona:` → `systemPrompt:`) and README section reorder recommendation
- FE: Hero.astro v0.3.6 → v0.6.0; README Roadmap [x]; AgentRoster YAML P0 fix confirmed; HowItWorks "Watch it run" step 04 (→ localhost:3456); QuickStart prereq note; Footer wordmark link; new landing.ts i18n keys
- QA: approved all 3 PRs, verified build (55 pages, 0 errors) each time

**Lessons:**
- Task board discipline remains weak — agents complete file work but skip claim_task/update_task. PM wrap-up had to manually close 6 stale todo tasks. Fix: orechstrator should verify get_all_tasks() before accepting end:_done; agent prompts need stronger update_task enforcement.
- Marketer agent is highly effective for first-impression copy work — should be added to agents.pool.yml permanently
- RELAY_SESSION_AGENTS_FILE cache is pre-populated on first list_agents call, so custom session teams won't show in dashboard UI (marketer not visible). Known limitation.
- Agent card "No activity yet" bug: task:updated events don't update agent card lastMessage — needs fix in App.tsx reducer

