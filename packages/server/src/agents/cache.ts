// packages/server/src/agents/cache.ts
// Centralized agent and pool cache — previously scattered inside createMcpServer() and hono.ts.
// Extracted to resolve the dual-cache problem (same data cached twice) and make cache state testable.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { getRelayDir } from "../config.js";
import { isValidId } from "../utils/validate.js";
import { loadAgents, loadPool } from "./loader.js";
import type { AgentPersona } from "./types.js";

// Pool cache TTL — pool file can change between sessions (e.g. during development).
// Stale-after-5-minutes ensures users see the updated pool without restarting the server.
const POOL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Lazy agent cache — populated on first getAgents() call.
// Key: session_id string, or "__default__" for the no-session-id case.
// Session-specific files are written once per /relay:relay run and never mutate; no TTL needed.
// Intentional design: unlike the pool cache (5-min TTL), session entries are never evicted.
// Edge case: if a session YAML is corrected while the server is running, the stale entry
// will persist until server restart or _invalidateCache() (test-only). This is acceptable
// because session files are considered immutable after the /relay:relay run writes them.
const agentsCache = new Map<string, Record<string, AgentPersona>>();

let pool: Record<string, AgentPersona> | null = null;
let poolCachedAt = 0;

/**
 * Load agents for a given session ID.
 * Returns null when the session file does not exist (caller must surface an error).
 * Returns the cached result on subsequent calls for the same session.
 */
export function getAgents(sessionId?: string): Record<string, AgentPersona> | null {
  // Validate sessionId to prevent path traversal and cache key poisoning.
  // Return null so list_agents surfaces an error rather than silently returning an empty team.
  if (sessionId && !isValidId(sessionId)) {
    return null;
  }

  const cacheKey = sessionId ?? "__default__";
  // biome-ignore lint/style/noNonNullAssertion: get() is safe after has() check
  if (agentsCache.has(cacheKey)) return agentsCache.get(cacheKey)!;

  let result: Record<string, AgentPersona>;
  try {
    if (sessionId) {
      // Load session-specific agent file: .relay/session-agents-{session_id}.yml
      const sessionFile = join(getRelayDir(), `session-agents-${sessionId}.yml`);
      if (existsSync(sessionFile)) {
        const parsed = yaml.load(readFileSync(sessionFile, "utf-8")) as Parameters<
          typeof loadPool
        >[0];
        if (!parsed) {
          console.error(`[relay] session file is empty or malformed: ${sessionFile}`);
        }
        // Load pool agents as fallback for extends resolution.
        // This allows session-file agents to extend pool agents by ID (e.g. fe2: { extends: fe }).
        // Pool load failure is non-fatal — extends will still work within the session file.
        let poolAgents: Record<string, AgentPersona> | undefined;
        try {
          poolAgents = getPool();
        } catch {
          poolAgents = undefined;
        }
        result = loadAgents(parsed ?? { agents: {} }, poolAgents);
      } else {
        // Session file not found — return null so the caller can return a distinct error.
        // Do NOT cache null: callers should be able to retry after the file is written.
        console.error(`[relay] session file not found: ${sessionFile}`);
        return null;
      }
    } else {
      // No session_id — pre-flight uses list_pool_agents, not list_agents.
      result = {};
    }
  } catch (err) {
    // Load failed (e.g. malformed YAML) — return null so list_agents surfaces a clear error
    // rather than silently returning an empty team. Do NOT cache null so callers can retry.
    console.error(
      `[relay] failed to load agents for session "${sessionId ?? "__default__"}":`,
      (err as Error).message
    );
    return null;
  }

  agentsCache.set(cacheKey, result);
  return result;
}

/**
 * Load the agent pool, with TTL-based caching.
 * Throws if no pool file is found or YAML is malformed.
 * On error, poolCachedAt is NOT updated — this allows immediate retry after creating the pool file.
 */
export function getPool(): Record<string, AgentPersona> {
  const now = Date.now();
  if (pool !== null && now - poolCachedAt < POOL_CACHE_TTL_MS) {
    return pool;
  }
  // Re-load (cache miss or expired). Do NOT update poolCachedAt on error — this allows
  // the caller to retry immediately after creating the pool file. Updating the timestamp
  // on failure would trap the caller in a 5-minute TTL even after the file is ready.
  pool = loadPool(); // throws if no pool file found or YAML is malformed
  poolCachedAt = now;
  return pool;
}

/**
 * Invalidate both caches.
 * @internal Test-only — do not call from production code.
 */
export function _invalidateCache(): void {
  agentsCache.clear();
  pool = null;
  poolCachedAt = 0;
}
