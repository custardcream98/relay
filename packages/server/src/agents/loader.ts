// packages/server/src/agents/loader.ts
// Loads agent personas from an explicit AgentsFile override or from the pool file.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { markAsAgentId } from "@custardcream/relay-shared";
import yaml from "js-yaml";
import { getProjectRoot, getRelayDir } from "../config";
import { isValidId } from "../utils/validate";
import type { AgentHooks, AgentPersona, AgentsFile, ResolvedAgentHooks } from "./types";

// Complete list of MCP tool names registered by createMcpServer() in mcp.ts.
// Validated against agent config tools[] to catch typos before runtime.
const REGISTERED_MCP_TOOLS = new Set([
  "get_server_info",
  "start_session",
  "send_message",
  "get_messages",
  "create_task",
  "update_task",
  "claim_task",
  "get_all_tasks",
  "post_artifact",
  "get_artifact",
  "request_review",
  "submit_review",
  "read_memory",
  "write_memory",
  "append_memory",
  "save_session_summary",
  "list_sessions",
  "get_session_summary",
  "broadcast_thinking",
  "list_agents",
  "list_pool_agents",
  "save_orchestrator_state",
  "get_orchestrator_state",
]);

/**
 * Validate an agent ID and throw a clear error if it contains invalid characters.
 * Delegates to isValidId() which uses anchored regex /^[a-zA-Z0-9_-]+$/.
 */
function validateAgentId(id: string): void {
  if (!isValidId(id)) {
    throw new Error(
      `agent id "${id}" contains invalid characters; use alphanumeric, hyphen, underscore only`
    );
  }
}

/**
 * Normalize AgentHooks from YAML (string | string[]) to ResolvedAgentHooks (string[]).
 * Validates that hook values are strings or arrays of strings.
 */
function resolveHooks(hooks: AgentHooks): ResolvedAgentHooks {
  const normalize = (val: string | string[] | undefined, field: string): string[] => {
    if (val === undefined) return [];
    if (typeof val === "string") return [val];
    if (Array.isArray(val) && val.every((v) => typeof v === "string")) return val;
    throw new Error(
      `hooks.${field} must be a string or array of strings, got: ${JSON.stringify(val)}`
    );
  };
  return {
    before_task: normalize(hooks.before_task, "before_task"),
    after_task: normalize(hooks.after_task, "after_task"),
  };
}

/**
 * Read a YAML file and parse it as AgentsFile.
 * Returns null if the file does not exist.
 * Throws on YAML parse errors so callers can surface a clear error message.
 */
function readYml(path: string): AgentsFile | null {
  if (!existsSync(path)) return null;
  // yaml.load() throws YAMLException on malformed input — let it propagate
  // so loadPool() callers receive a descriptive error instead of a silent null.
  return yaml.load(readFileSync(path, "utf-8")) as AgentsFile;
}

/**
 * Resolve {{block_name}} placeholders in a systemPrompt using shared_blocks definitions.
 * Also substitutes {agent_id} within each block with the actual agent ID.
 * Throws if a referenced block is not defined in shared_blocks.
 */
function resolveSharedBlocks(
  systemPrompt: string,
  sharedBlocks: Record<string, string>,
  agentId: string
): string {
  return systemPrompt.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (_match, blockName: string) => {
    const block = sharedBlocks[blockName];
    if (block === undefined) {
      throw new Error(
        `shared_blocks reference "{{${blockName}}}" in agent "${agentId}" is not defined. ` +
          `Available blocks: ${Object.keys(sharedBlocks).join(", ") || "(none)"}`
      );
    }
    // Substitute {agent_id} within the block content
    return block.replace(/\{agent_id\}/g, agentId);
  });
}

/**
 * Validate that an agent's systemPrompt contains required sections.
 * Throws on missing sections — agents without proper structure lose context between spawns.
 * Called by loadPool() to enforce prompt quality at pool load time.
 */
export function validatePromptSections(agentId: string, systemPrompt: string): void {
  const requiredSections = [
    { header: "### On Each Spawn", label: "On Each Spawn" },
    { header: "### Declaring End", label: "Declaring End" },
    { header: "## Rules", label: "Rules" },
  ];

  const missing = requiredSections.filter(({ header }) => !systemPrompt.includes(header));
  if (missing.length > 0) {
    throw new Error(
      `agent "${agentId}" systemPrompt is missing required sections: ${missing.map((s) => `"${s.label}"`).join(", ")}. ` +
        `Every agent must include "### On Each Spawn", "### Declaring End", and "## Rules".`
    );
  }
}

/**
 * Pass 1: Resolve base agents (those without extends).
 * Returns a merged record of resolved personas.
 */
function resolveBaseAgents(
  entries: [string, AgentsFile["agents"][string]][],
  globalLanguage: string | undefined,
  poolAgents: Record<string, AgentPersona> | undefined,
  sharedBlocks?: Record<string, string>,
  globalReviewChecklist?: string
): Record<string, AgentPersona> {
  const merged: Record<string, AgentPersona> = {};

  for (const [id, config] of entries) {
    if (config.disabled) continue;
    if (config.extends) continue; // handled in pass 2

    validateAgentId(id);

    const language = config.language ?? globalLanguage;
    const review_checklist = config.review_checklist ?? globalReviewChecklist;

    // Agent without extends must have all required fields.
    // systemPrompt may be omitted in session-agents files — fall back to the pool agent's prompt.
    const { name, emoji, tools } = config;
    let systemPrompt = config.systemPrompt ?? poolAgents?.[id]?.systemPrompt;
    if (!name || !emoji || !tools || !systemPrompt) {
      throw new Error(
        `agent "${id}" is missing required fields (name, emoji, tools, systemPrompt). ` +
          `If this is a session-agents file, ensure the agent ID matches a pool entry so systemPrompt can be resolved from the pool.`
      );
    }

    // Resolve {{block_name}} placeholders in systemPrompt
    if (sharedBlocks) {
      systemPrompt = resolveSharedBlocks(systemPrompt, sharedBlocks, id);
    }

    // Validate that all listed tools are registered MCP tools
    const unknownTools = tools.filter((t) => !REGISTERED_MCP_TOOLS.has(t));
    if (unknownTools.length > 0) {
      throw new Error(
        `agent "${id}" lists unknown tools: ${unknownTools.join(", ")}. ` +
          `Valid tools: ${[...REGISTERED_MCP_TOOLS].sort().join(", ")}`
      );
    }
    const persona: AgentPersona = {
      id: markAsAgentId(id),
      ...config,
      // Use the resolved systemPrompt (may come from pool fallback when config omits it)
      systemPrompt,
      ...(language ? { language } : {}),
      ...(review_checklist ? { review_checklist } : {}),
    } as AgentPersona;

    // Normalize hooks: false → undefined; string | string[] → string[]
    if (config.hooks === false || config.hooks == null) {
      persona.hooks = undefined;
    } else if (config.hooks) {
      persona.hooks = resolveHooks(config.hooks);
    }

    merged[id] = persona;
  }

  return merged;
}

/**
 * Pass 2: Resolve extends agents (those that inherit from a base agent).
 * Mutates the merged record in-place.
 */
function resolveExtendsAgents(
  entries: [string, AgentsFile["agents"][string]][],
  merged: Record<string, AgentPersona>,
  globalLanguage: string | undefined,
  poolAgents: Record<string, AgentPersona> | undefined,
  sharedBlocks?: Record<string, string>,
  globalReviewChecklist?: string
): void {
  for (const [id, config] of entries) {
    if (config.disabled) continue;
    if (!config.extends) continue; // already handled in pass 1

    validateAgentId(id);

    const language = config.language ?? globalLanguage;

    // Look up the base agent: first within the same file, then fall back to pool agents.
    // This allows session-file agents to extend pool agents by ID (e.g. fe2: { extends: fe }).
    const base = merged[config.extends] ?? poolAgents?.[config.extends];
    if (!base) {
      throw new Error(
        `extends target "${config.extends}" not found or is disabled` +
          (poolAgents ? " (searched current file and pool)" : "")
      );
    }

    // review_checklist inheritance: config > base > global
    // Unlike language (which is a directive), review_checklist should cascade through extends.
    const review_checklist =
      config.review_checklist ?? base.review_checklist ?? globalReviewChecklist;

    // Only spread config keys that are explicitly set (not undefined) so that
    // omitted fields don't overwrite inherited values from base.
    // hooks: false is an explicit opt-out of inherited hooks.
    const configOverrides = Object.fromEntries(
      Object.entries(config).filter(([, v]) => v !== undefined)
    );

    // If extends agent overrides systemPrompt and shared_blocks exist, resolve placeholders
    let resolvedSystemPrompt: string | undefined;
    if (config.systemPrompt && sharedBlocks) {
      resolvedSystemPrompt = resolveSharedBlocks(config.systemPrompt, sharedBlocks, id);
    }

    const merged_persona = {
      ...base,
      ...configOverrides,
      id: markAsAgentId(id),
      extends: undefined,
      basePersonaId: config.extends, // preserve the base persona ID before clearing extends
      ...(language ? { language } : {}),
      ...(review_checklist ? { review_checklist } : {}),
      // Use resolved systemPrompt if the extends agent overrides it with shared_blocks
      ...(resolvedSystemPrompt ? { systemPrompt: resolvedSystemPrompt } : {}),
    } as AgentPersona;

    // Normalize hooks from this agent's config entry (if present).
    // - hooks: false  → explicit opt-out, clear inherited hooks
    // - hooks: {...}  → re-normalize in case the config uses string (not string[])
    // - hooks absent  → base.hooks is already ResolvedAgentHooks, no action needed
    const configHooks = (configOverrides as { hooks?: unknown }).hooks;
    if (configHooks === false) {
      merged_persona.hooks = undefined;
    } else if (configHooks != null) {
      // Config provided new hooks — normalize string | string[] → string[]
      merged_persona.hooks = resolveHooks(configHooks as AgentHooks);
    }
    // else: inherited from base, already resolved — no re-normalization needed

    merged[id] = merged_persona;
  }
}

/**
 * Load agent personas from an explicit AgentsFile.
 * Disabled agents are excluded from the result.
 * When using extends, the specified agent's config is inherited and then overridden.
 *
 * @param override - The agents file to load (session file or pool file)
 * @param poolAgents - Optional pool agents to use as fallback for extends resolution.
 *   Allows session-file agents to extend pool agents by ID.
 */
export function loadAgents(
  override: AgentsFile,
  poolAgents?: Record<string, AgentPersona>
): Record<string, AgentPersona> {
  const entries = Object.entries(override.agents);
  const globalLanguage = override.language;
  const sharedBlocks = override.shared_blocks;
  const globalReviewChecklist = override.review_checklist;

  // Two-pass resolution: first resolve base agents, then extends agents.
  // This makes YAML declaration order irrelevant for extends chains.
  const merged = resolveBaseAgents(
    entries,
    globalLanguage,
    poolAgents,
    sharedBlocks,
    globalReviewChecklist
  );
  resolveExtendsAgents(
    entries,
    merged,
    globalLanguage,
    poolAgents,
    sharedBlocks,
    globalReviewChecklist
  );

  return merged;
}

/**
 * Load agent pool personas.
 * Reads .relay/agents.pool.yml first, then agents.pool.yml at project root.
 * Throws a clear error when no pool file is found — no silent fallback.
 * Disabled agents are excluded. The pool does NOT enforce the "at least one agent" check.
 */
export function loadPool(override?: AgentsFile): Record<string, AgentPersona> {
  if (override) {
    // When an explicit override is provided, load it as agents directly
    const agents = loadAgents(override);
    // Pool agents must have proper prompt structure — validate and throw on missing sections
    for (const [id, persona] of Object.entries(agents)) {
      validatePromptSections(id, persona.systemPrompt);
    }
    return agents;
  }

  // Try .relay/agents.pool.yml, then root-level agents.pool.yml
  const poolFile =
    readYml(join(getRelayDir(), "agents.pool.yml")) ??
    readYml(join(getProjectRoot(), "agents.pool.yml"));

  if (poolFile) {
    return loadPool(poolFile);
  }

  // No pool file found — throw a clear, actionable error
  throw new Error(
    "No agent pool configured. Create .relay/agents.pool.yml (see agents.pool.example.yml) or run /relay:relay to auto-generate one."
  );
}
