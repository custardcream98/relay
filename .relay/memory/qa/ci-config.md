# CI/CD Configuration

## GitHub Actions Workflows (`.github/workflows/`)

### ci.yml — runs on push to main + all PRs
Four parallel jobs:
1. **Lint + Format** (`bun run check` via Biome)
2. **Test** (`bun test`)
3. **Type Check** (`bunx tsc --noEmit`)
4. **Dashboard Build** (`bun run --filter @custardcream/relay-dashboard build`)

All jobs use `oven-sh/setup-bun@v2` with `bun-version: latest` and `bun install --frozen-lockfile`.

### release.yml — runs on push to main only
- Uses `changesets/action@v1`
- Creates a "Version Packages" PR when changesets exist
- On PR merge: runs `bun run release` to publish to npm
- Requires `GITHUB_TOKEN` + `NPM_TOKEN` secrets
- `concurrency` scoped to workflow+ref to avoid parallel release runs

### deploy-docs.yml — triggered on push to main (only `packages/docs/**` changes) or manual dispatch
- Two jobs: **Build** then **Deploy** (to GitHub Pages)
- Notably uses `actions/setup-node@v4` with `node-version: "22"` in addition to Bun (Astro v5 requires Node ≥ 18)
- Uploads artifact from `packages/docs/dist`
- Concurrency group `"pages"` with `cancel-in-progress: false` (safe deployment)

## Release Workflow
- Changeset-based: `bunx changeset` → commit → push → CI creates Version PR → merge → CI publishes
- Do NOT run `bun run publish:server` directly

## Linting / Formatting Tool
- **Biome** (`@biomejs/biome ^2.4.6`) — handles both lint and format
- **Husky** (`^9.1.7`) — git hooks (via `prepare` script)

## Notable CI Gaps
- No coverage report step in CI (no `--coverage` flag)
- No integration/E2E test stage
- Dashboard and docs packages are only build-checked, not test-checked
- `bun-version: latest` (not pinned) could cause flaky CI on Bun breaking changes
