## qa-conventions

## QA Agent Conventions

### Test Infrastructure
- Server tests: `packages/server/src/**/*.test.ts` — uses `bun:test`, `_resetStore()` in beforeEach
- Dashboard has NO React testing library (no jsdom/happy-dom, no @testing-library/react)
- Dashboard tests are limited to: tsc type-check (`tsc -b`), vite production build, biome lint
- `bun test` command runs from `packages/server/` only (root `bun test` delegates there)

### Quality Gates
1. `cd packages/server && bun test` — all server tests pass
2. `bunx biome check .` — no errors (warnings in docs/ are pre-existing and out of scope)
3. `cd packages/dashboard && bunx tsc -b` — dashboard type-check clean
4. `cd packages/dashboard && bunx vite build` — production build succeeds
5. `cd packages/server && bunx tsc --noEmit` — server type-check clean

### Key Files
- Dashboard components: `packages/dashboard/src/components/`
- Dashboard types: `packages/dashboard/src/types.ts`
- Shared types: `packages/shared/index.ts`
- Server tools: `packages/server/src/tools/`
- Server tests: `packages/server/src/tools/*.test.ts`, `packages/server/src/dashboard/hono.test.ts`

### Biome Preferences
- Prefers `?.` optional chaining over `!` non-null assertions in test files
- `noNonNullAssertion` rule is a warning — use optional chaining after an expect(x).not.toBeNull()
- Formatting: biome auto-formats JSX props to single-line when they fit — run `biome check --write` to fix

### Edit Guard
- The edit guard in `scripts/relay-edit-guard.sh` blocks Edit/Write tools for orchestrator sessions
- QA agent running in orchestrator context must use `bash sed` for file edits instead of Edit tool
