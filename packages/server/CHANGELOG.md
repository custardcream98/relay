# @custardcream/relay

## 0.1.0

### Minor Changes

- 148ff43: Support `.relay/agents.yml` as a project-local agent override

  Previously, per-project agent customization required editing `agents.yml` at the project root, which is part of the framework's own source tree. This change adds `.relay/agents.yml` as a higher-priority override path, so users can customize agents without touching framework files. The lookup order is now: `.relay/agents.yml` → `agents.yml` → built-in defaults.

## 0.0.3

### Patch Changes

- 4cfa872: fix: correct npx invocation in .mcp.json to use --package flag with explicit binary name

## 0.0.2

### Patch Changes

- 586776a: fix: specify relay-server bin name explicitly in .mcp.json npx args
