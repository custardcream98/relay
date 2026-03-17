# Install Modes

Installation is handled entirely by the Claude Code marketplace plugin.

## Marketplace plugin (recommended)

Users install relay via the Claude Code marketplace. The plugin handles:
- Skills installation
- MCP server registration

No manual install script is needed.

## MCP Server Config (`.mcp.json`)

Used when running from npm:
```json
{ "command": "npx", "args": ["-y", "--package", "@custardcream/relay", "relay"] }
```
- `--package @custardcream/relay` ensures npx finds the binary even if package name differs from bin name
- Bin name: `relay` → `./dist/index.js`

## Plugin Config (`.claude-plugin/plugin.json`)

- name: "relay", version: "0.13.1"
- Metadata only: description, author, repository, license, keywords

## Post-install

Run `/reload-plugins` in Claude Code to activate the new skills and MCP server.
