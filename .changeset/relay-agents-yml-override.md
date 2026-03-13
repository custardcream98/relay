---
"@custardcream/relay": minor
---

Support `.relay/agents.yml` as a project-local agent override

Previously, per-project agent customization required editing `agents.yml` at the project root, which is part of the framework's own source tree. This change adds `.relay/agents.yml` as a higher-priority override path, so users can customize agents without touching framework files. The lookup order is now: `.relay/agents.yml` → `agents.yml` → built-in defaults.
