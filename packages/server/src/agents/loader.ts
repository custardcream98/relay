// packages/server/src/agents/loader.ts
// Loads agents.default.yml + agents.yml (optional) and returns merged agent personas.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
// Embeds file content as string at build time — no path issues after bundling/npm publish
import defaultYmlText from "../../../../agents.default.yml";
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

/** Parse the default AgentsFile embedded in the bundle */
function parseDefaultYml(): AgentsFile {
  // esbuild bundles .yml as a string; bun:test imports it as a parsed object
  if (typeof defaultYmlText === "string") {
    return yaml.load(defaultYmlText) as AgentsFile;
  }
  return defaultYmlText as unknown as AgentsFile;
}

/**
 * Load agent personas.
 * Applies the optional override file; otherwise reads agents.yml from the project root.
 * Disabled agents are excluded from the result.
 * When using extends, the specified agent's config is inherited and then overridden.
 */
export function loadAgents(override?: AgentsFile): Record<string, AgentPersona> {
  // 1. Use embedded defaults from build time (no filesystem access needed)
  const defaultFile = parseDefaultYml();

  // 2. Load user customizations — .relay/agents.yml takes priority, fallback to root agents.yml
  const customFile = override ??
    readYml(join(getRelayDir(), "agents.yml")) ??
    readYml(join(getProjectRoot(), "agents.yml")) ?? { agents: {} };

  // 3. Merge defaults with custom overrides
  const defaults = defaultFile.agents;
  const customs = customFile.agents;

  const merged: Record<string, AgentPersona> = {};

  // Global language setting (fallback when per-agent language is absent)
  const globalLanguage = customFile.language;

  // Process built-in agents
  for (const [id, config] of Object.entries(defaults)) {
    const custom = customs[id] ?? {};
    if (custom.disabled) continue;
    const language = custom.language ?? globalLanguage;
    merged[id] = { id, ...config, ...custom, ...(language ? { language } : {}) } as AgentPersona;
  }

  // Process custom-only agents (extends or brand-new)
  for (const [id, config] of Object.entries(customs)) {
    if (id in merged) continue; // Already processed above
    if (config.disabled) continue;

    const language = config.language ?? globalLanguage;

    if (config.extends) {
      // Extending a disabled or nonexistent agent is an error
      const base = merged[config.extends];
      if (!base) throw new Error(`extends target "${config.extends}" not found or is disabled`);
      merged[id] = {
        ...base,
        ...config,
        id,
        extends: undefined,
        ...(language ? { language } : {}),
      } as AgentPersona;
    } else {
      // New custom agent without extends must have all required fields
      const { name, emoji, tools, systemPrompt } = config;
      if (!name || !emoji || !tools || !systemPrompt) {
        throw new Error(
          `custom agent "${id}" is missing required fields: name, emoji, tools, systemPrompt`
        );
      }
      merged[id] = { id, ...config, ...(language ? { language } : {}) } as AgentPersona;
    }
  }

  if (Object.keys(merged).length === 0) {
    throw new Error(
      "No agents defined. Create agents.yml in your project root with at least one agent.\n" +
        "See agents.example.yml for a complete example.\n" +
        "Required fields: name, emoji, tools, systemPrompt"
    );
  }

  return merged;
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
 * Load workflow configuration.
 * If a custom workflow.jobs override exists, merge it with the defaults at the job level.
 */
export function getWorkflow(override?: AgentsFile): WorkflowConfig {
  const defaultFile = parseDefaultYml();

  const customFile = override ??
    readYml(join(getRelayDir(), "agents.yml")) ??
    readYml(join(getProjectRoot(), "agents.yml")) ?? { agents: {} };

  const defaultJobs = defaultFile.workflow?.jobs ?? {};
  const customJobs = customFile.workflow?.jobs ?? {};

  // Override at the job level (merge individual job fields)
  const mergedJobs = { ...defaultJobs };
  for (const [jobId, jobOverride] of Object.entries(customJobs)) {
    mergedJobs[jobId] = { ...mergedJobs[jobId], ...jobOverride };
  }

  return { jobs: mergedJobs };
}
