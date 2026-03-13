# Build Process

## Build Order
1. Dashboard must be built first: `bun run dashboard:build`
   - Output: `packages/dashboard/dist/`
2. Server is built second: `bun run build:server`
   - Runs `packages/server/build.ts` via `bun run build`
   - Output: `packages/server/dist/index.js`
3. Combined: `bun run build:release` = dashboard:build + build:server

## Server Build Details (`packages/server/build.ts`)
- Bundles `src/index.ts` using `Bun.build()` with target: "bun"
- Externalizes `bun:sqlite` (Bun built-in, cannot be bundled)
- Adds `#!/usr/bin/env bun` shebang and sets executable bit (chmod 755)
- Copies dashboard `dist/` → `packages/server/dist/dashboard/`
- Output: `packages/server/dist/index.js` (single bundled file)

## Published Package (`@custardcream/relay`)
- `files`: only `dist/` directory is published
- `bin`: `relay-server` → `./dist/index.js`
- `publishConfig.access`: "public" (npm public package)
- Version: 0.2.1 (server package; root monorepo is private at 0.1.0)

## Key Scripts (root package.json)
- `bun run dev` — dev server with hot reload (filter: @custardcream/relay)
- `bun run build:release` — full release build (dashboard + server)
- `bun run test` — run tests (filter: @custardcream/relay)
- `bun run check` — biome lint + format check
