---
"@custardcream/relay": patch
---

## Refactoring: Remove SQLite db layer, improve dashboard styling

### Server (`@custardcream/relay`)

**Remove redundant `db/queries/` pass-through layer**

- Deleted `db/queries/` (artifacts, events, messages, reviews, sessions, tasks), `db/client.ts`, `db/schema.ts`, and `db/types.ts` — these were zero-value wrappers after the SQLite → in-memory store migration
- All tools, hono routes, and WebSocket handlers now import directly from `store.ts`
- Tests migrated from per-test SQLite instances to `_resetStore()` — faster, no native bindings required

No changes to any MCP tool API or agent configuration format.

### Dashboard (`@custardcream/relay-dashboard`, internal)

**Introduce `cn()` utility (clsx + tailwind-merge)**

- `src/lib/cn.ts`: `cn(...inputs)` helper for safe, conflict-free Tailwind class composition

**Maximize Tailwind CSS usage — 84% reduction in inline styles (262 → 41)**

- All color tokens expressed via CSS-variable arbitrary values (`bg-[var(--color-surface-raised)]`)
- Animations via arbitrary animation classes (`animate-[blink_1.1s_step-end_infinite]`)
- Conditional classes composed with `cn()`, replacing JS hover state handlers
- Added CSS custom properties for warning banner and priority colors to `index.css`
- Remaining 41 inline styles are all legitimate runtime-dynamic values (hex+alpha agent accents, `color-mix()` backdrop, `WebkitLineClamp`, drag-resize state)
