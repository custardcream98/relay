
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


---
_2026-03-14_

_2026-03-14_

## Session 2026-03-14-004: Landing Page Dashboard Visual

**Team**: pm, designer, docs-writer, fe

**Accomplishments**:
- Designer: detailed spec for DashboardPreview section (browser-chrome frame, 3-panel layout, CSS animations)
- docs-writer: created `DashboardPreview.astro` — browser-chrome-framed 3-panel dashboard mockup (Kanban / Message Feed / Agent Thoughts) with pure CSS animations (blinking cursor, card pulse, message fade-in); added 11 i18n keys (en + ko-KR); integrated into index.astro + ko-KR/index.astro
- Fixed favicon bug in Landing.astro: `${BASE_URL}favicon.svg` → `${BASE_URL}/favicon.svg` (BASE_URL is `/relay` without trailing slash, causing `/relayfavicon.svg`)
- Build: 55 pages, 0 errors

**Lessons**:
- favicon path bug: BASE_URL in this Astro project is `/relay` (no trailing slash). Always use `${BASE_URL}/path` pattern, not `${BASE_URL}path`.
- docs-writer proceeded with implementation in parallel with designer spec — effective for clear briefs
- fe had no tasks this session; could be skipped for pure docs/content tasks

---
_2026-03-14_

_2026-03-14_

## Session 2026-03-14-005: Concurrent Session Isolation

**Team**: pm, mcp-architect, be, qa

**Accomplishments:**
- mcp-architect: Designed full concurrent session isolation spec — session-scoped agentsCache Map, session-specific file naming, fallback chain separation, backward compat strategy
- be: Implemented 3-file change (mcp.ts, SKILL.md, .gitignore). Key fix: agentsCache Map<string, Record<string, AgentPersona>>, getAgents(sessionId?) with fully separated fallback chains
- be2 review caught BLOCKER: sessionId path was incorrectly falling back to RELAY_SESSION_AGENTS_FILE — fixed in v2
- qa: 65/65 tests pass, final PR verified

**Key decisions:**
- sessionId present: `session-agents-{id}.yml` → `loadAgents()` (RELAY_SESSION_AGENTS_FILE skipped entirely)
- sessionId absent: `RELAY_SESSION_AGENTS_FILE` → `loadAgents()` (legacy behavior preserved)
- Pre-flight list_agents has NO session_id; Session Startup list_agents DOES pass session_id
- Cache key "__default__" used when no session_id provided

**Lessons:**
- mcp-architect agent is valuable for protocol/schema design before implementation — caught edge cases (pre-flight vs session-startup cache key collision) that would have been bugs
- be2 reviewer caught a real BLOCKER (fallback chain bug) — always use peer review for concurrency changes
- Having mcp-architect write spec to both artifact AND .relay/memory/ file was effective — be could reference either

---
_2026-03-14_

_2026-03-14_

## Session 2026-03-14-006: Dashboard Improvements — Thoughts Panel + Session Switcher

**Team**: pm, fe, fe2, fe3, be, be2, qa

**Accomplishments:**
- fe3: Fixed AgentArena.tsx lastTask bug — removed `if (!lastTaskByAgent[t.assignee])` guard so the latest task always overwrites, showing most recent activity
- fe3: Added `broadcast_thinking` to 8 agents in `.relay/agents.pool.yml` (be, fe, designer, qa, mcp-architect, dx-engineer, security-reviewer, oss-maintainer)
- fe2: Removed `SessionReplay.tsx` entirely + cleaned up all App.tsx/AppHeader.tsx references
- fe: Added session switcher to AppHeader.tsx — dropdown fetches `/api/sessions`, selecting one loads snapshot; LIVE badge when on current session; `viewingSessionId` state in App.tsx; `SET_SESSION_SNAPSHOT` reducer action freezes TaskBoard+MessageFeed to historical data
- be: Added `GET /api/sessions/:id/snapshot` endpoint to hono.ts — returns `{ session_id, tasks, messages, artifacts }`, session_id regex validated (400 on invalid), empty arrays on unknown session
- Thoughts panel (`agent:thinking` WebSocket → `thinkingChunks` state → `AgentDetailPanel` Thoughts tab) was already implemented; sessions 006 completed the loop by adding `broadcast_thinking` to pool agents' tool lists
- Build: 0 errors, 65/65 tests pass

**Lessons:**
- Context compaction mid-session caused task status drift — agents completed work but couldn't update tasks; orchestrator had to reconcile file state vs. DB state manually
- fe2 posting PR artifact but leaving task as `todo` is a recurring pattern — task discipline enforcement remains weak
- All code changes survived context loss intact (git-tracked filesystem) — only DB task statuses were stale

---
_2026-03-14_

_2026-03-14_

## Session 2026-03-14-007: Concurrent Session Review + agents.yml Removal + Multi-instance Agents

**Team**: pm, mcp-architect, be, security-reviewer, qa

**Accomplishments:**

**[A] Concurrent Session Isolation Review:**
- mcp-architect: 현 격리 설계(agentsCache Map, session-agents-{id}.yml) 안전 확인. 개선 권장: auto-generated session_id에 4자리 random hex suffix 추가
- be: loader.ts stateless 설계 확인 (agentsCache Map 의도적 미구현), config.ts/DB 격리 정상
- security-reviewer: HIGH 2건 발견 — updateTask/claimTask WHERE session_id 누락, list_agents sessionId path traversal
- qa: +11 신규 세션 격리 테스트 작성 (65 → 76 pass)

**[B] agents.yml 제거 + pool 전용화:**
- loader.ts `loadPool()`: `loadAgents()` fallback 제거, pool 없으면 명확한 에러 throw
- `getAgents(sessionId?)`: sessionId 없으면 `{}` 반환 — pre-flight은 `list_pool_agents` 사용
- skills/relay/SKILL.md: Team Composition에서 agents.yml 질문 제거, pool 선택 항상 필수로 변경
- skills/init/SKILL.md: agents.pool.yml 생성 플로우로 재작성
- CLAUDE.md: 전체 agents.yml 참조 pool 기반으로 교체

**[C] 동일 에이전트 다중 인스턴스:**
- `extends` 패턴으로 코드 변경 없이 즉시 지원 (fe2: { extends: fe })
- agents.pool.example.yml에 multi-instance 예시 주석 추가
- skills/relay/SKILL.md Pool Selection에 "add N of same agent" UX 가이드 추가

**Security Fixes (all approved by security-reviewer):**
- updateTask/claimTask: `AND session_id = ?` WHERE 조건 추가
- getAgents(): sessionId `/^[a-zA-Z0-9_-]+$/` 검증 추가 (path traversal 차단)
- hono.ts /api/sessions/:id/events: sessionId 검증 추가 (400 반환)
- index.ts + config.ts: --session / RELAY_INSTANCE 검증 추가 (exit(1) on invalid)

**Final test count: 76/76 pass**

**Lessons:**
- security-reviewer가 2라운드로 실제 코드 검증까지 완료하는 패턴이 효과적
- mcp-architect가 extends 패턴을 설계로 제안 → 코드 변경 0으로 [C-2] 해결 (loader.ts 기존 코드 활용)
- agents.yml 제거는 loader.ts 최소 변경으로 처리 가능했음 — 하위 호환 deprecation 경고 패턴 유용
- be가 6개 태스크(SEC x4 + B-2 + C-2)를 한 번의 스폰으로 처리 — 태스크 범위가 명확하면 효율적


---
_2026-03-14_

---
_2026-03-14_

## Session 2026-03-14-001: Docs Intro Visual Hook + README Rewrite

**Team**: pm, docs-writer, oss-maintainer, designer

**Accomplishments:**
- docs-writer: Created `DashboardPreviewDocs.astro` (standalone i18n-free version of DashboardPreview for MDX use); updated `introduction.mdx` (EN + ko-KR) with "Watch it happen live" section embedding animated 3-panel dashboard mockup; created `packages/docs/public/screenshots/` dir with capture guide README + placeholder SVG. Build: 47 pages, 0 errors.
- oss-maintainer: Full README.md rewrite — problem-first hook ("Stop prompting one agent. Ship with a whole team."), benefit-focused copy, dashboard screenshot placeholder, install commands preserved, strong closing CTA.
- designer: Visual strategy audit — posted spec recommending P0 DashboardPreview embed in intro (done), P0 README dashboard section improvement (done), P1 AgentTeamDiagram.astro for animated team diagram (future work).

**Lessons:**
- `DashboardPreviewDocs.astro` pattern (i18n-free copy of landing component) is useful for embedding in MDX docs pages
- Designer's P1 suggestion (AgentTeamDiagram.astro — animated SVG with agent accent colors) is a good future enhancement
- Real screenshots still needed: run relay session → capture `localhost:3456` at 1280×800 → place in `packages/docs/public/screenshots/dashboard.png`


---
_2026-03-14_

## Session 2026-03-14-008: Dashboard UX Overhaul

**Team**: pm, designer, be, fe, fe2, qa, docs-writer

**Accomplishments:**
- fe: `ActivityFeed.tsx` (new) — replaces EventTimeline with chat-style unified feed. 7 event variants (broadcast/DM/thinking/task/artifact/review/end), filter persistence, auto-scroll, focus agent filter.
- fe: `useTheme.ts` + light mode CSS tokens + AppHeader toggle (☀/☾)
- fe: 3 bug fixes — STATUS_COLOR.done, snapshot task timestamps, Korean comments
- fe2: `MessageFeed.tsx` full redesign — chronological, avatar+group threading, left-border bubbles, auto-scroll, system pills for end:* messages
- fe2: `AgentCard.tsx` — thinking bubble with blinking cursor, status-based empty states
- be: `GET /api/servers` missing endpoint added; `task:updated` description field added to WebSocket events; Korean → English comments
- docs-writer: Real screenshots (dashboard-en.png + dashboard-ko.png, 1280×800) captured and saved
- Tests: 76/76 pass, dashboard build 0 errors

**Lessons:**
- fe + fe2 parallel pattern worked well — ActivityFeed and MessageFeed worked on separately with mutual code review
- be gap analysis before fe implementation was valuable — caught the missing GET /api/servers and task:updated description field early
- designer spec artifact significantly guided fe/fe2 implementation (same as session 003 lesson)
- QA proactively finding bugs during initial pass (before fe PRs) saved a re-spawn cycle
- Session-agents file uses a logical session ID (2026-03-14-008) while server uses auto-generated session ID — task updates must use the server's session ID, not the logical one

