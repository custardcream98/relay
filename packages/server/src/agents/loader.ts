// packages/server/src/agents/loader.ts
// Loads agent personas from an explicit AgentsFile override or from the pool file.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { markAsAgentId } from "@custardcream/relay-shared";
import yaml from "js-yaml";
import { getProjectRoot, getRelayDir } from "../config";
import type { AgentPersona, AgentsFile, WorkflowConfig } from "./types";

// Complete list of MCP tool names registered by createMcpServer() in mcp.ts.
// Validated against agent config tools[] to catch typos before runtime.
export const REGISTERED_MCP_TOOLS = new Set([
  "get_server_info",
  "start_session",
  "send_message",
  "get_messages",
  "create_task",
  "update_task",
  "get_my_tasks",
  "claim_task",
  "get_team_status",
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
  "get_workflow",
]);

/**
 * Read a YAML file and parse it as AgentsFile.
 * Returns null if the file does not exist.
 */
function readYml(path: string): AgentsFile | null {
  if (!existsSync(path)) return null;
  return yaml.load(readFileSync(path, "utf-8")) as AgentsFile;
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
  const agents = override.agents;
  const merged: Record<string, AgentPersona> = {};

  // Global language setting (fallback when per-agent language is absent)
  const globalLanguage = override.language;

  // Two-pass resolution: first resolve base agents, then extends agents.
  // This makes YAML declaration order irrelevant for extends chains.
  const entries = Object.entries(agents);

  // Pass 1: resolve agents without extends
  for (const [id, config] of entries) {
    if (config.disabled) continue;
    if (config.extends) continue; // handled in pass 2

    const language = config.language ?? globalLanguage;

    // Agent without extends must have all required fields.
    // systemPrompt may be omitted in session-agents files — fall back to the pool agent's prompt.
    const { name, emoji, tools } = config;
    const systemPrompt = config.systemPrompt ?? poolAgents?.[id]?.systemPrompt;
    if (!name || !emoji || !tools || !systemPrompt) {
      throw new Error(`agent "${id}" is missing required fields: name, emoji, tools, systemPrompt`);
    }
    // Validate that all listed tools are registered MCP tools
    const unknownTools = tools.filter((t) => !REGISTERED_MCP_TOOLS.has(t));
    if (unknownTools.length > 0) {
      throw new Error(
        `agent "${id}" lists unknown tools: ${unknownTools.join(", ")}. ` +
          `Valid tools: ${[...REGISTERED_MCP_TOOLS].sort().join(", ")}`
      );
    }
    merged[id] = {
      id: markAsAgentId(id),
      ...config,
      // Use the resolved systemPrompt (may come from pool fallback when config omits it)
      systemPrompt,
      ...(language ? { language } : {}),
    } as AgentPersona;
  }

  // Pass 2: resolve agents that use extends (base agents are all resolved now)
  for (const [id, config] of entries) {
    if (config.disabled) continue;
    if (!config.extends) continue; // already handled in pass 1

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
    merged[id] = {
      ...base,
      ...config,
      id: markAsAgentId(id),
      extends: undefined,
      ...(language ? { language } : {}),
    } as AgentPersona;
  }

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
    return loadAgents(override);
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
    "No agent pool configured. Create .relay/agents.pool.yml (see agents.pool.example.yml)."
  );
}

/**
 * Inject memory into an agent's system prompt.
 * Prepends project memory (project.md), team retrospectives (lessons.md),
 * and the agent's personal memory (agents/{id}.md) in that order.
 * If persona.language is set, appends a language instruction at the end.
 */
export function buildSystemPromptWithMemory(persona: AgentPersona, relayDir: string): string {
  const memoryPath = join(relayDir, "memory", "agents", `${persona.id}.md`);
  const projectPath = join(relayDir, "memory", "project.md");
  const lessonsPath = join(relayDir, "memory", "lessons.md");

  const agentMemory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : null;
  const projectMemory = existsSync(projectPath) ? readFileSync(projectPath, "utf-8") : null;
  const lessonsMemory = existsSync(lessonsPath) ? readFileSync(lessonsPath, "utf-8") : null;

  // Language instruction — appended last to give it the highest priority
  const languageInstruction = persona.language
    ? `\n\n## Language\n\nYou MUST respond in ${persona.language} at all times.`
    : "";

  const parts: string[] = [
    projectMemory ? `## Project Memory\n\n${projectMemory}` : null,
    lessonsMemory ? `## Team Retrospectives & Decision History\n\n${lessonsMemory}` : null,
    agentMemory ? `## My Memory (learned from previous sessions)\n\n${agentMemory}` : null,
  ].filter((s): s is string => s !== null);

  if (parts.length === 0) return `${persona.systemPrompt}${languageInstruction}`;

  return `${parts.join("\n\n---\n\n")}\n\n---\n\n${persona.systemPrompt}${languageInstruction}`;
}

/**
 * Load workflow configuration from an explicit AgentsFile.
 * If a custom workflow.jobs override exists, merge it with the defaults at the job level.
 */
export function getWorkflow(override: AgentsFile): WorkflowConfig {
  const jobs = override.workflow?.jobs ?? {};
  return { jobs };
}
