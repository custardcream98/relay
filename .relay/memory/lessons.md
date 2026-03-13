
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
