# Concurrent Session Isolation — Design Spec

**Author**: mcp-architect
**Session**: 2026-03-14-005
**Status**: Final

---

## Problem

When two `/relay:relay` sessions run simultaneously against the same MCP server process,
they share a single `.relay/session-agents.yml` file and a single-slot agent cache.
Session B writing its team overwrites Session A's file; whichever session calls `list_agents`
second gets the wrong team.

Root causes:
1. `.relay/session-agents.yml` is a hardcoded single filename — concurrent writes race
2. `let agents: ... | null = null` cache never invalidates within a process lifetime
3. `RELAY_SESSION_AGENTS_FILE` is a single process-wide env var — cannot track two sessions

---

## Solution Overview

Three coordinated changes — no new env vars, no breaking API changes:

| Layer | Change |
|---|---|
| MCP tool | Add `session_id?: string` to `list_agents` |
| `mcp.ts` | `agents` var → `agentsCache: Map<string, ...>` |
| Skill | Write `session-agents-{session_id}.yml`; pass `session_id` to `list_agents` |
| `.gitignore` | `session-agents.yml` → `session-agents*.yml` |

---

## Change 1: `list_agents` Tool Schema

**File**: `packages/server/src/mcp.ts`

```typescript
server.tool(
  "list_agents",
  {
    agent_id: z.string().describe("ID of the calling agent (for tracking)"),
    session_id: z.string().optional().describe(
      "Session ID to scope agent loading. When provided, loads " +
      ".relay/session-agents-{session_id}.yml before falling back to agents.yml"
    ),
  },
  async (input) => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify(
          Object.values(getAgents(input.session_id)).map((a) => ({
            id: a.id,
            name: a.name,
            emoji: a.emoji,
            description: a.description,
            tools: a.tools,
            systemPrompt: a.language
              ? `${a.systemPrompt}\n\n## Language\n\nYou MUST respond in ${a.language} at all times.`
              : a.systemPrompt,
          }))
        ),
      }],
    };
  }
);
```

---

## Change 2: Agent Cache — `Map<string, Record<string, AgentPersona>>`

**File**: `packages/server/src/mcp.ts` (inside `createMcpServer()` closure)

Replace:
```typescript
let agents: Record<string, AgentPersona> | null = null;
```

With:
```typescript
// Key: session_id string, or "__default__" for the no-session-id case
const agentsCache = new Map<string, Record<string, AgentPersona>>();
```

Replace `getAgents()`:
```typescript
function getAgents(sessionId?: string): Record<string, AgentPersona> {
  const cacheKey = sessionId ?? "__default__";

  if (agentsCache.has(cacheKey)) {
    return agentsCache.get(cacheKey)!;
  }

  let result: Record<string, AgentPersona>;
  try {
    if (sessionId) {
      // Session-specific override file takes priority
      const sessionFile = join(getRelayDir(), `session-agents-${sessionId}.yml`);
      if (existsSync(sessionFile)) {
        const parsed = yaml.load(readFileSync(sessionFile, "utf-8")) as Parameters<
          typeof loadAgents
        >[0];
        result = loadAgents(parsed ?? undefined);
      } else {
        // Fall back to legacy env var, then agents.yml
        const legacyFile = process.env.RELAY_SESSION_AGENTS_FILE;
        if (legacyFile && existsSync(legacyFile)) {
          const parsed = yaml.load(readFileSync(legacyFile, "utf-8")) as Parameters<
            typeof loadAgents
          >[0];
          result = loadAgents(parsed ?? undefined);
        } else {
          result = loadAgents();
        }
      }
    } else {
      // No session_id — legacy behavior
      const legacyFile = process.env.RELAY_SESSION_AGENTS_FILE;
      if (legacyFile && existsSync(legacyFile)) {
        const parsed = yaml.load(readFileSync(legacyFile, "utf-8")) as Parameters<
          typeof loadAgents
        >[0];
        result = loadAgents(parsed ?? undefined);
      } else {
        result = loadAgents();
      }
    }
  } catch {
    result = {};
  }

  agentsCache.set(cacheKey, result);
  return result;
}
```

No changes to `loadAgents()`, `loadPool()`, or `config.ts`.

---

## Change 3: Skill — Session-Specific File Naming

**File**: `skills/relay/SKILL.md`

### Team Composition section — step 5 (current):
```
Write the file at `.relay/session-agents.yml`.
Set the `RELAY_SESSION_AGENTS_FILE` environment variable to the absolute path of this file
so the server picks it up on its next `list_agents` call.
```

### Replace with:
```
Write the file at `.relay/session-agents-{session_id}.yml`
(where {session_id} is the session ID generated in Pre-flight step 3).

Do NOT set RELAY_SESSION_AGENTS_FILE — pass session_id directly to list_agents instead.
```

### Session Startup step 1 — current:
```
Call `list_agents` to get the active roster (reflects any `session-agents.yml` override).
```

### Replace with:
```
Call `list_agents(agent_id: "orchestrator", session_id: "{session_id}")` to get the active
roster. The session_id ensures the server loads the correct session-agents file.
```

### Session Wrap-up step 3 — current:
```
if `.relay/session-agents.yml` was written during Team Composition, delete it
```

### Replace with:
```
if `.relay/session-agents-{session_id}.yml` was written during Team Composition, delete it
(it is ephemeral and gitignored).
```

---

## Change 4: `.gitignore` Pattern

Current (in `.gitignore` or `.relay/.gitignore`):
```
session-agents.yml
```

Replace with:
```
session-agents*.yml
```

---

## Backward Compatibility

| Scenario | Behavior |
|---|---|
| `list_agents` with no `session_id` | Uses `__default__` cache key; legacy `RELAY_SESSION_AGENTS_FILE` env var respected |
| `list_agents` with `session_id` | Checks `session-agents-{id}.yml` first; falls back to env var, then `agents.yml` |
| Old skill writing `session-agents.yml` + setting env var | Still works via legacy fallback path |
| New skill writing `session-agents-{id}.yml` + passing `session_id` | Correct isolated behavior |

---

## Edge Cases

### Pre-flight vs. Session Startup list_agents calls
- Pre-flight calls `list_agents` WITHOUT `session_id` → `__default__` key → reads `agents.yml` team
- Team Composition writes `session-agents-{id}.yml`
- Session Startup calls `list_agents` WITH `session_id` → new cache key → reads custom team

These two calls use different cache keys, so no stale data problem.

### Cache memory
Each entry ~10–20 KB. 100 concurrent sessions = ~2 MB. No eviction needed.

### File deleted before cache evicted
Once loaded, in-memory data persists for the process lifetime. Correct behavior — ephemeral file
is only needed at load time.

### Malformed session-agents file
Caught by try/catch; falls back to `{}`. Existing behavior preserved.

---

## Implementation Checklist

- [ ] `packages/server/src/mcp.ts`
  - [ ] Add `join` import from `node:path` if not already present
  - [ ] Replace `let agents: ... | null = null` with `const agentsCache = new Map<...>()`
  - [ ] Replace `getAgents()` function with new version accepting `sessionId?: string`
  - [ ] Add `session_id` optional param to `list_agents` tool; pass to `getAgents()`
- [ ] `skills/relay/SKILL.md`
  - [ ] Team Composition step 5: change filename + remove RELAY_SESSION_AGENTS_FILE instruction
  - [ ] Session Startup step 1: add `session_id` to `list_agents` call
  - [ ] Session Wrap-up step 3: update cleanup filename
- [ ] `.gitignore`: `session-agents.yml` → `session-agents*.yml`
