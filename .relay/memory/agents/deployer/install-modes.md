# Install Modes

## Two modes: local vs global

### Local install
```bash
bun run install:local
# = bun run scripts/install.ts
```
- Skills copied to: `.claude/skills/relay/` (project-local)
- MCP registered with `--scope local` (only active in this project)
- Server runs from local build: `bun run <project>/packages/server/dist/index.js`

### Global install
```bash
bun run install:global
# = bun run scripts/install.ts --global
```
- Skills copied to: `~/.claude/skills/relay/`
- MCP registered with `--scope user` (active across all Claude Code projects)
- Server runs from local build: `bun run <project>/packages/server/dist/index.js`

## Install Script Steps (`scripts/install.ts`)
1. Runs `bun run build:release` (dashboard + server build)
2. Copies `skills/` directory to destination (removes old copy first)
3. Removes existing MCP registration (error ignored), then re-registers:
   `claude mcp add relay --scope <local|user> -- bun run dist/index.js`
4. Prints instructions: run `/reload-plugins` in Claude Code to activate

## MCP Server Config (`.mcp.json`)
- Used when running from npm (not local build):
  ```json
  { "command": "npx", "args": ["-y", "--package", "@custardcream/relay", "relay-server"] }
  ```
- `--package @custardcream/relay` ensures npx finds the binary even if package name differs from bin name
- Bin name: `relay-server` → `./dist/index.js`

## Plugin Config (`.claude-plugin/plugin.json`)
- name: "relay", version: "0.1.0"
- Metadata only: description, author, repository, license, keywords

## Local override rule
Local install takes precedence over global install (Claude Code behavior).

## Post-install
Run `/reload-plugins` in Claude Code to activate the new skills and MCP server.
