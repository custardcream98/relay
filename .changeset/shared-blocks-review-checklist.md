---
"@custardcream/relay": minor
---

feat: add shared_blocks template system and review_checklist to pool YAML

- Add `shared_blocks` top-level field: define reusable text blocks referenced as `{{block_name}}` in agent systemPrompts. `{agent_id}` within blocks is auto-substituted at load time. Undefined references throw.
- Add `review_checklist` top-level + per-agent field: structured review criteria with 3-tier inheritance (per-agent > base agent > global). Exposed in `list_agents` and `list_pool_agents` API responses.
- Add `validatePromptSections()`: enforces `### On Each Spawn`, `### Declaring End`, `## Rules` in pool agent prompts (throws on missing sections).
- Refactor `agents.pool.example.yml`: 6 shared_blocks (3 structural + 3 behavioral), 12 agents use `{{block_name}}` references, domain-specific content enrichment per role.
- Update SKILL.md: Auto-Pool Generation principle 10 (shared_blocks), role-type templates with `{{block_name}}`, pre-write checklist, Reviewer Spawn Pattern with Fix-First framework.
