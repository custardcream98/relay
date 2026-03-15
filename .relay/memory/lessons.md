
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


---
_2026-03-14_

---
_2026-03-15_

## Session 2026-03-15-001: Sprint A — Dashboard Bug Fixes

**Team**: pm, be, fe, fe2, qa

**Accomplishments:**
- BE: Added `review:updated` to RelayEvent union (packages/shared/index.ts); `submit_review` in mcp.ts now broadcasts the event with full review payload; added integration test via DB assertion pattern (no mock/spy needed — broadcast writes to events table)
- FE: Fixed `lastActivityByAgent` in AgentArena.tsx — now uses `updateActivity(agentId, label, ts)` helper comparing Unix-ms timestamps across both tasks and messages; most-recent-wins per agent; "No activity yet" only for genuinely inactive agents
- FE: Added `review:updated` case to App.tsx reducer (timeline entry + baseUpdates)
- FE2: Implemented ServerSwitcher WebSocket reconnection — `useRelaySocket` now accepts `serverUrl?: string`; `toWsUrl()` helper converts HTTP→WS URL; effect re-runs on URL change; `handleSwitchServer` in App.tsx updates `activeServer` state, clears snapshot, guards same-server no-op
- FE2: Fixed TDZ bug — `activeServer` useState moved above `useRelaySocket` call in App.tsx
- BE: Added review:updated broadcast test (83 tests total)
- Tests: 83/83 pass, dashboard build 0 errors

**Lessons:**
- QA found TDZ bug (activeServer declared after useRelaySocket usage) that fe2 had introduced — good catch. Pattern: always declare useState hooks used by other hooks BEFORE those hook calls.
- DB-assertion pattern for broadcast testing (getEventsBySession as oracle) works cleanly without mocks — reuse this pattern for future broadcast tests
- /relay:agent skill was fixed this session to call start_session — previously agent MCP tool calls were scoped to the previous session's ID


---
_2026-03-14_

---
_2026-03-15_

## Session 2026-03-15-002: Comprehensive Code Review + Security Hardening

**Team**: pm, be, fe, security-reviewer, mcp-architect, qa

**Accomplishments:**

**BE (6 bugs fixed):**
- config.ts: UTC inconsistency in session ID generation (getHours → getUTCHours)
- tools/review.ts, tasks.ts, messaging.ts, artifacts.ts: all lacked try/catch — added structured error returns to all handlers
- hono.ts /api/session: unguarded DB failure now returns JSON error

**FE (5 bugs fixed + cleanup):**
- useRelaySocket.ts: socket not closed on serverUrl change → added socketRef + cleanup
- ActivityFeed.tsx: review:updated event silently dropped (no case) → added ReviewUpdatedEntry + filter
- App.tsx + AppHeader.tsx: API fetches used hardcoded relative URLs, ignored activeServer → fixed all to use activeServer-prefixed absolute URLs
- ServerSwitcher.tsx: URL parse crash → try/catch fallback
- Deleted dead files: EventTimeline.tsx, MessageFeed.tsx (orphaned, never imported)

**Security (4 fixes):**
- H1 CRITICAL: CORS middleware added to Hono (localhost-only)
- H2 HIGH: WebSocket origin validation (socket.destroy() for non-localhost)
- H3 HIGH: ServerSwitcher SSRF — isLocalhostUrl() validation + inline error UI
- M1 MEDIUM: Content length limits on Zod schemas (send_message 64KB, post_artifact 512KB, memory 128KB)

**MCP Architect (5 fixes + findings):**
- agent:thinking excluded from DB persistence
- get_server_info, list_agents, list_pool_agents, get_workflow: added success: true envelope
- loader.ts: extends two-pass resolution bug fixed
- Remaining low-priority: session:snapshot not emitted via WS, team:composed missing from RelayEvent, tools array not validated

**QA (test coverage):**
- 83 → 111 tests (+28): hono.test.ts (14), sessions.test.ts (+7), review.test.ts (+4), loader.test.ts (+3)

**PM (direct fixes):**
- Korean comments in production code translated to English

**Final: 111/111 tests pass, build 0 errors**

**Lessons:**
- Missing try/catch was systemic across all tool handlers — good pattern to enforce in code review
- API fetches that ignore activeServer are a common bug when adding multi-server support; always grep for hardcoded relative URLs after such features
- security-reviewer + be two-pass pattern (audit then fix) continues to work well
- Dead file detection: always check for orphaned imports after component reorganization


---
_2026-03-14_

---
_2026-03-15_

## Session 2026-03-15-003-c4d8: Follow-up Review Pass

**Team**: pm, be, fe, qa

**Accomplishments:**

**BE:**
- `team:composed` added to RelayEvent union in packages/shared/index.ts; local `TeamComposedEvent` workaround removed from dashboard/src/types.ts; App.tsx switch updated
- `REGISTERED_MCP_TOOLS` set added to loader.ts; loadAgents() now throws on unknown tool names; 2 new tests added
- 5-min TTL added to pool cache in mcp.ts and cachedAgents in hono.ts
- `DASHBOARD_PORT` env var NaN validation added to index.ts
- session:snapshot confirmed already present in RelayEvent (no change needed)

**FE (3 bugs fixed):**
- AgentDetailPanel.tsx: `STATUS_COLOR.todo` was a CSS var — alpha suffix `${statusColor}18` was invalid CSS; fixed to hex `#6b7280`
- AppHeader.tsx: `fetchSessions` missing `r.ok` check before `r.json()` — added HTTP error guard
- usePanelResize.ts: window drag listeners leaked on unmount — added useEffect cleanup refs

**QA:**
- Updated QA baseline in .relay/agents.pool.yml from 65 → 111
- Added 16 new tests: websocket.test.ts (5), config.test.ts (10), loader.test.ts (2)
- Final test count: 129 pass, 0 fail

**Lessons:**
- CSS var alpha-suffix pattern (`${cssVar}18`) silently produces invalid CSS — always use hex literals for opacity variants
- Always check `r.ok` before calling `.json()` in fetch handlers — non-2xx responses return HTML error bodies
- Event listener cleanup on unmount is easy to miss for drag handlers attached to `window` (not the component's element)
- Team:composed was referenced in code comments but missing from the shared RelayEvent union — always cross-check event type mentions in comments/docs against the actual union

---
_2026-03-14_

---
_2026-03-15_

## Session 2026-03-15-003: Dashboard Loading Fix + Task Board Collapse Verification

**Team**: pm, be, fe, qa

**Accomplishments:**
- BE: Port conflict root cause identified — second instance hitting EADDRINUSE but `get_server_info` still returning stale URL. Fixed: `setPort(null)` on EADDRINUSE; `get_server_info` now returns `dashboardUrl: null` + `dashboardAvailable: false`
- FE: Task Board collapse was already implemented in `usePanelResize.ts` + `App.tsx` — confirmed working
- FE: Fixed type mismatch in shared/index.ts — `task:updated.task` and `session:snapshot.tasks` missing `created_at?/updated_at?` fields
- Tests: 111 → 129 pass (+18 new: hono.test.ts +14, sessions/review/loader additions)

**Key lessons:**
- Before implementing a feature, check if it already exists — Task Board collapse was already there
- Port conflict "dashboard not showing" was caused by EADDRINUSE being swallowed silently; making it explicit (null URL + dashboardAvailable: false) is the correct fix
- FE initial hydration relies 100% on WebSocket session:snapshot — if WS connection fails or delays, screen stays blank; this is by design but worth noting
- session:snapshot missing sessionId field is a known gap for multi-server scenarios


---
_2026-03-15_

---
_2026-03-15_

## Session 2026-03-15-004-d3e4: Dashboard Bug Fixes + Message Delivery Improvement

**Team**: pm, be, fe, mcp-architect, qa

**Accomplishments:**

**[FIXED by orchestrator directly]**
- App.tsx: TaskBoard collapse layout bug — ActivityFeed was stuck at `timelinePct%` height when collapsed, leaving black space below. Fixed: when `taskBoardCollapsed`, ActivityFeed uses `flex: "1 1 0"` to fill remaining space.
- App.tsx: Collapse/expand icons were ASCII text `v`/`^` — replaced with proper SVG chevrons.

**BE (2 bugs fixed):**
- mcp.ts: `agentsCache` was caching empty `{}` on load failure (catch block) — now skips caching on error, allowing retry without server restart.
- loader.ts: `loadAgents(override, poolAgents?)` — added optional pool fallback parameter so session file `extends` can reference pool agents. `getAgents()` now calls `loadAgents(parsed, getPool())`. +3 new tests (132 total).

**FE (2 bugs fixed):**
- AgentDetailPanel.tsx: `STATUS_COLOR` fallback was a CSS var (`var(--color-text-disabled)`), producing invalid CSS like `var(--color-text-disabled)18` when used as hex alpha suffix → replaced with `STATUS_COLOR_FALLBACK = "#6b7280"` hex.
- ActivityFeed.tsx: "Showing last 200 events" banner checked `entries.length >= 200` (unfiltered) instead of `filtered.length >= 200` — misleading when filters active.

**MCP Architect (message delivery improvement):**
- Root cause: SKILL.md discipline note had no mandatory `send_message` rules; agents could exit without declaring `end:`.
- skills/relay/SKILL.md: Added `## Mandatory Communication Protocol` section injected into all agent system prompts.
- skills/relay/SKILL.md: Strengthened "no declaration" respawn message.
- skills/agent/SKILL.md: Added Communication Protocol injection for single-agent spawns.
- mcp.ts: Added `"document"` to artifact type enum (Zod validation was failing silently).

**Final: 132/132 tests pass, dashboard build 0 errors**

**Lessons:**
- agentsCache silent-failure caching: never cache error/empty results — callers should be able to retry
- `extends` in session files now supports pool agent references — CLAUDE.md was ahead of implementation; be fixed the implementation to match docs
- CSS var + hex alpha suffix (`${cssVar}18`) produces invalid CSS — always use hex literals for alpha variants (same lesson as session 003)
- Message delivery was a prompt/protocol problem, not an infrastructure problem — `messaging.ts` implementation was correct; the fix was in SKILL.md discipline rules
- `post_artifact` type enum was missing `"document"` — agents using it got Zod validation failures silently; always verify enum completeness against agent usage patterns


---
_2026-03-15_

---
_2026-03-15_

## Session 2026-03-15-005-b2c9: Relay Codebase Audit

**Team**: be, mcp-architect, security-reviewer, qa, dx-engineer

**Confirmed Bugs & Issues (prioritized):**

**HIGH — Functional Breakage:**
1. `list_pool_agents` omits `systemPrompt` intentionally, but `skills/relay/SKILL.md` Team Composition step 5 instructs to use it for building session-agents YAML → agents spawned with no system prompts. Fix: instruct skill to use `list_agents(session_id)` after writing session file, OR read pool YAML directly.
2. `hooks/hooks.json` hardcodes port 3456 — auto-selected port instances lose ALL `agent:status` dashboard events silently.
3. `list_agents` returns `{ success: true, agents: [] }` when session file not found — orchestrator cannot distinguish "empty team" from "file not written yet."
4. `--session` CLI arg maps to `RELAY_INSTANCE` (DB prefix/instance name), NOT `RELAY_SESSION_ID` — confusing naming, contradicts user expectation.

**MEDIUM — Logic Bugs:**
5. `get_messages` returns self-sent broadcasts back to sender — potential infinite loop if agent reacts to all received messages.
6. `handleWriteMemory`: read-then-write is non-atomic (race condition). `handleAppendMemory` uses atomic `appendFile` correctly.
7. `submit_review` allows double-submit — no pending-only guard.
8. `RELAY_SESSION_ID` env var not validated against `/^[a-zA-Z0-9_-]+$/` (inconsistent with `RELAY_INSTANCE` validation).
9. Double language directive injection: `list_agents` in `mcp.ts` appends language directive AND `buildSystemPromptWithMemory()` does it again — duplicated instruction in agent prompts.

**LOW — Minor Issues:**
10. `updateTask` with no valid fields returns "task not found" instead of "no fields to update".
11. Event replay ordering non-deterministic: `getEventsBySession` sorts by `created_at` (seconds resolution) with no tiebreaker.
12. `GET /api/sessions/:id` (summary route) missing input validation guard — sibling routes `/snapshot` and `/events` both validate.
13. MCP server version hardcoded as `"0.1.0"` in `mcp.ts` — not synced with `package.json`.
14. `db/queries/events.ts` uses `.ts` extension in import — inconsistent with all other files.
15. `save_session_summary` Zod description says `YYYY-MM-DD-NNN` format — stale, actual is `YYYY-MM-DD-NNN-XXXX`.
16. `team:composed` RelayEvent type defined in shared/index.ts but never emitted.
17. `handlePostArtifact` and `handleGetArtifact` declared `async` with no actual async ops.

**Lessons:**
- The SKILL.md `list_pool_agents` bug is a systemic DX issue — every session team composition step is broken unless the orchestrator reads the pool YAML file directly (which the current skill does via Write tool).
- hooks.json hardcoded port is a silent multi-instance failure — should use `${DASHBOARD_PORT:-3456}` or be templated.
- `--session` → `RELAY_INSTANCE` naming is a trap for new users; rename the CLI flag or add an alias.
- agent_id input validation gap: messaging/tasks/artifacts tools accept any string; security-sensitive tools (memory, sessions) validate. Make validation uniform.


---
_2026-03-15_

---
_2026-03-15_

## Session 2026-03-15-006-c3a1: Security Hardening + Test Isolation + Correctness

**Team**: be, qa, security-reviewer

**Accomplishments:**

**BE (6 tasks):**
- agent_id `.regex(/^[a-zA-Z0-9_-]+$/).max(64)` added to all 20 agent_id fields in mcp.ts
- handleWriteMemory: unlink .tmp file on rename() failure
- config.ts: path.resolve() applied to RELAY_DIR and RELAY_DB_PATH env vars
- db/client.ts: PRAGMA foreign_keys = ON after migrations
- index.ts: WebSocketServer maxPayload: 1MB
- CLAUDE.md: fixed MCP tool response envelope docs (flat responses, not nested data)

**Security-reviewer (4 additional findings → 4 more BE tasks):**
- to/reviewer/assignee/thread_id fields in mcp.ts Zod schemas: regex+maxLength added
- session_id .max(128) added to start_session, save_session_summary, get_session_summary
- /api/hook/tool-use: agent_id validated before broadcasting (fallback to "unknown")
- loadAgents(): YAML agent id keys validated against /^[a-zA-Z0-9_-]+$/ before use
- isValidMemoryKey(): maxLength 256 added

**QA (2 tasks):**
- Test isolation: _resetSessionId() in websocket.test.ts afterEach; _resetProjectRoot() added to config.ts + used in config.test.ts; UUID-based temp paths in loader.test.ts
- New test coverage: GET /api/sessions/:id (400 for invalid id, 404 for unknown); POST /api/hook/tool-use (403 for non-localhost origin, 403 for malformed origin)

**Final: 136/136 tests pass**

**Lessons:**
- Security-reviewer finding secondary validation gaps (to, reviewer, assignee fields) after BE fixed agent_id is a recurring pattern — consider adding a "validate all agent-routing fields" checklist to the agent pool systemPrompt
- extends pattern in session-agents YAML (extends: be) is the right approach — avoids duplicating systemPrompt and always stays in sync with pool; never write systemPrompt directly in session files
- Parallel agent execution means each agent's test count reflects their own view — always run bun test after all agents finish to get the authoritative count
- Biome import ordering: bun:test imports must come before node:* imports (third-party before built-in) — check import order whenever adding new node:* imports to test files


---
_2026-03-15_

---
_2026-03-15_

## Session 2026-03-15-007-a4b2: Deep Audit Pass (5-agent specialist team)

**Team**: be, qa, security-reviewer, mcp-architect, dx-engineer

**Findings & Fixes — 28 issues total, all fixed:**

**BE (4 fixed):**
- config.ts: auto-generated session IDs had no random suffix → same-second collision risk. Fixed: YYYY-MM-DD-HHmmss-XXXX (4-char hex)
- hono.ts: /api/sessions/:id/events and /snapshot had no try/catch → unhandled DB exceptions
- mcp.ts: getAgents() returned {} (not null) on malformed YAML → silently treated as empty team
- review.ts: handleSubmitReview could return { success: true, review: null } on re-fetch failure
- db/queries/sessions.ts + websocket.ts: .ts extension in module imports (invalid in Node ESM builds)

**Security (8 fixes in mcp.ts):**
- title .max(256), description .max(8192) on create_task
- summary .max(131072) on save_session_summary
- content .max(65536) on broadcast_thinking
- list_agents session_id: .regex + .max(128)
- post_artifact/get_artifact name .max(256)
- submit_review comments .max(16384)
- send_message thread_id: .regex added
- DASHBOARD_PORT: p <= 65535 guard

**QA (+24 tests, 136 → 160):**
- memory.test.ts: isValidMemoryKey edge cases (empty, >256, \n, \r), agent_id path-traversal rejection
- loader.test.ts: YAML key validation (space, slash, dots, extends)
- config.test.ts: path.resolve() on relative env vars
- artifacts.test.ts: get_artifact not-found, post_artifact without task_id
- schema.test.ts: runMigrations idempotency + index existence

**MCP Architect (1 fix):**
- review.ts: handleSubmitReview null re-fetch now returns proper error (confirmed above)
- Confirmed: 24 tools registered, REGISTERED_MCP_TOOLS matches exactly, all RelayEvent types covered
- Low-priority: session:snapshot hydrates agents from pool (not session-specific team file)

**DX (8 fixes):**
- agents.pool.example.yml: broadcast_thinking missing from ALL 12 agent tool lists (CRITICAL — calls would silently fail)
- skills/agent/SKILL.md: list_agents → list_pool_agents in pre-flight (list_agents returns empty without session file)
- CLAUDE.md: RELAY_SESSION_ID default, session ID format, build commands, tasks.ts tool list
- skills/relay/SKILL.md: session ID format NNN → NNN-XXXX
- agents.pool.example.yml: comment typo session-agents.yml → session-agents-{session_id}.yml

**Lessons:**
- broadcast_thinking missing from agents.pool.example.yml is a critical DX bug class: the skill injects the tool into agent prompts but pool file didn't list it → calls blocked silently. Always cross-check skill-injected tool names against pool file tool arrays.
- Session ID collision was a real risk: two server processes starting in the same UTC second would share a session ID and mix data. The 4-char hex suffix + already-present session_id + rowid tiebreaker together make collisions statistically impossible.
- MCP tool count drifts from persona descriptions as tools are added — mcp-architect persona said "18 tools" but actual count was 24. Consider generating this count dynamically or adding a CI check.
- session:snapshot uses pool agents (loadPool()) not the session-specific team for agent metadata — this means the dashboard shows all pool agents, not just the active session team. Low priority but worth noting.


---
_2026-03-15_

_2026-03-15_

## Session 2026-03-15-008-f3c9: User Flow Audit

**Team**: dx-engineer, be, docs-writer, mcp-architect

**Critical finding**: hooks.json `http` type hook URL field does NOT support shell variable expansion in Claude Code hook runner. `${DASHBOARD_PORT:-3456}` was silently failing as a literal URL string. Fixed by replacing `http` type with `command` type (curl) — shell expansion works in command strings.

**Key pattern**: Always use `command` type with curl for hooks that need env var interpolation. `http` type URL is a literal string.

**DX audit lessons**:
- Skills can contain false guidance (init skill said "restart MCP server" after pool file creation — wrong, loadPool() reads fresh each call)
- Docs and CLAUDE.md had several stale values (session_id format, RELAY_SESSION_ID default, CLI flag names) — need to update docs whenever config behavior changes
- loader.ts error messages without next-action guidance frustrate new users — always include "Run X to fix" in error messages

**Remaining low-priority known gaps** (not fixed this session):
- session:snapshot agents field never populated → SessionTeamBadge always empty
- /api/agents returns pool agents (not session-specific team) → extends instances (fe2, fe3) missing from dashboard
- pre-flight list_agents always empty — can't confirm server connectivity this way

