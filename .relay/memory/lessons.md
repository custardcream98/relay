
---
_2026-03-13_

## 2026-03-13 — Landing Page Session

**Shipped:** relay landing page at `packages/docs/` (Astro static site, GH Pages)

**What worked well:**
- Extending packages/docs/ with a custom index.astro bypassing Starlight was the right call — no new package needed
- FE build passed cleanly on first attempt; Tailwind v4 + CSS custom property token approach was clean
- BE deploy-docs.yml review caught the configure-pages ordering issue before merge

**Lessons:**
- Agent tasks must be marked done in real-time; letting them accumulate to "todo" creates confusing task board state
- QA catching favicon BASE_URL hardcode is a good reminder: any path referencing the base must use `import.meta.env.BASE_URL`
- `end:` declarations should be verified in get_messages before advancing to next job — don't rely only on task notifications
- qa and deployer intentionally share orange-400 color per dashboard spec; this is not a bug

---
_2026-03-13_

## 2026-03-13 — Dashboard Redesign Session

**Shipped:** Major visual redesign of `packages/dashboard/`

**What changed:**
- `index.css`: Inter + JetBrains Mono fonts, full CSS custom property design token system (surfaces, borders, text, agent accents, status/priority/connection colors, shadows, keyframes)
- `App.tsx`: refined header (wordmark + pill badge, connection glow), 32px panel headers
- `AgentStatusBar.tsx`: slimmer chips, per-agent accent colors, 5px status dot with scale-pulse animation
- `TaskBoard.tsx`: column top accent bars, always-visible count badge, left-edge priority bar, assignee chips with tinted bg, card shadows
- `MessageFeed.tsx`: 28px avatar circles with accent tint, broadcast badge, improved empty state
- `AgentThoughts.tsx`: inner sub-header strip, better no-agent state, cursor driven by `status` prop not `chunks.length`, auto-scroll pause + "↓ latest" button
- `MarkdownContent.tsx`: updated to CSS var color scheme
- NEW `constants/agents.ts`: shared `AGENT_ACCENT_HEX` map (eliminates duplication across 4 files)

**Lessons:**
- FE2 review caught cursor logic bug (chunks.length vs status), duplicated color maps, and scroll direction issue — worth running review even for UI-only changes
- `biome-ignore` is the right tool for unavoidable a11y patterns (role="status" on non-form elements, static divs with visual-only mouse handlers)
- Pass status prop down from App.tsx state rather than inferring from derived UI state
- biome format --write should be run before manual lint fixes to separate concerns

