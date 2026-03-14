// packages/server/src/agents/loader.ts
// Loads agent personas from an explicit AgentsFile override or from the pool file.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { markAsAgentId } from "@custardcream/relay-shared";
import yaml from "js-yaml";
import { getProjectRoot, getRelayDir } from "../config";
import type { AgentPersona, AgentsFile, WorkflowConfig } from "./types";

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
 */
export function loadAgents(override: AgentsFile): Record<string, AgentPersona> {
  const agents = override.agents;
  const merged: Record<string, AgentPersona> = {};

  // Global language setting (fallback when per-agent language is absent)
  const globalLanguage = override.language;

  for (const [id, config] of Object.entries(agents)) {
    if (config.disabled) continue;

    const language = config.language ?? globalLanguage;

    if (config.extends) {
      // Extending a disabled or nonexistent agent is an error
      const base = merged[config.extends];
      if (!base) throw new Error(`extends target "${config.extends}" not found or is disabled`);
      merged[id] = {
        ...base,
        ...config,
        id: markAsAgentId(id),
        extends: undefined,
        ...(language ? { language } : {}),
      } as AgentPersona;
    } else {
      // Agent without extends must have all required fields
      const { name, emoji, tools, systemPrompt } = config;
      if (!name || !emoji || !tools || !systemPrompt) {
        throw new Error(
          `agent "${id}" is missing required fields: name, emoji, tools, systemPrompt`
        );
      }
      merged[id] = {
        id: markAsAgentId(id),
        ...config,
        ...(language ? { language } : {}),
      } as AgentPersona;
    }
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
