# Release Process

## Changeset Workflow (preferred — do NOT run `bun run publish:server` directly)

### Step 1: Create changeset
```bash
bunx changeset
# Select patch / minor / major
# Only @custardcream/relay is published; dashboard and docs are ignored in .changeset/config.json
```

### Step 2: Commit and push
```bash
git add .changeset/
git commit -m "chore: add changeset"
git push
```

### Step 3: CI auto-handles the rest
- `release.yml` workflow triggers on push to `main`
- Uses `changesets/action@v1`
- If pending changesets exist → creates "chore: version packages" PR
- When that PR is merged → runs `bun run release` which publishes to npm

## `bun run release` (what CI runs on merge)
= `bun run build:release && changeset publish`
- Builds dashboard + server
- Publishes `@custardcream/relay` to npm with NPM_TOKEN

## CI Workflows
- **ci.yml**: Triggers on push/PR to main — runs lint (biome check), tests (bun test), type check (tsc --noEmit), dashboard build
- **release.yml**: Triggers on push to main — manages changeset versioning + npm publish
- **deploy-docs.yml**: Triggers on push to main when `packages/docs/**` changes — builds Astro docs and deploys to GitHub Pages at https://custardcream98.github.io/relay

## Changeset Config (`.changeset/config.json`)
- baseBranch: main
- access: public
- ignored: @custardcream/relay-dashboard, @custardcream/relay-docs (not published to npm)
- updateInternalDependencies: patch

## Required Secrets
- `GITHUB_TOKEN` — auto-provided by GitHub Actions
- `NPM_TOKEN` — must be set in repository secrets for npm publish
