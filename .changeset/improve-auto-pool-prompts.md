---
"@custardcream/relay": minor
---

feat(skill): improve auto-pool prompt quality and add pool gap analysis

- Expand Agent Prompt Design Principles from 6 to 9 (mandatory sections, artifact naming, inter-agent communication)
- Add 4 role-type prompt structure templates (Coordinator, Implementer, Quality, Knowledge Worker)
- Add Pre-write Checklist as a hard gate before pool file generation
- Add Pool Gap Analysis to Team Composition — suggests adding agents when pool doesn't cover the task
- Support "session only" temporary agents alongside permanent pool additions
- Reference agents.pool.example.yml as the gold standard for prompt quality
- Fix message cursor tracking: m.id → m.seq throughout event loop pseudocode
