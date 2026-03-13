// packages/server/src/agents/loader.ts
// Loads agents.default.yml + agents.yml (optional) and returns merged agent personas.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
// 빌드 시점에 파일 내용을 문자열로 embed — 번들/npm 배포 후에도 경로 문제 없음
import defaultYmlText from "../../../../agents.default.yml" with { type: "text" };
import type { AgentPersona, AgentsFile, WorkflowConfig } from "./types";

// agents.yml allows per-project customization — resolved relative to CWD (user project root)
const PROJECT_ROOT = process.cwd();
// .relay/agents.yml — 세션별 오버라이드 (git 추적 없이 커스터마이즈 가능)
const RELAY_DIR = process.env.RELAY_DIR ?? join(PROJECT_ROOT, ".relay");

/**
 * Read a YAML file and parse it as AgentsFile.
 * Returns null if the file does not exist.
 */
function readYml(path: string): AgentsFile | null {
  if (!existsSync(path)) return null;
  return yaml.load(readFileSync(path, "utf-8")) as AgentsFile;
}

/** 번들에 embed된 기본 AgentsFile을 파싱 */
function parseDefaultYml(): AgentsFile {
  return yaml.load(defaultYmlText) as AgentsFile;
}

/**
 * Load agent personas.
 * Applies the optional override file; otherwise reads agents.yml from the project root.
 * Disabled agents are excluded from the result.
 * When using extends, the specified agent's config is inherited and then overridden.
 */
export function loadAgents(override?: AgentsFile): Record<string, AgentPersona> {
  // 1. 빌드 시 embed된 기본값 사용 (파일 시스템 접근 불필요)
  const defaultFile = parseDefaultYml();

  // 2. Load user customizations — .relay/agents.yml 우선, 없으면 루트 agents.yml
  const customFile = override ??
    readYml(join(RELAY_DIR, "agents.yml")) ??
    readYml(join(PROJECT_ROOT, "agents.yml")) ?? { agents: {} };

  // 3. Merge defaults with custom overrides
  const defaults = defaultFile.agents;
  const customs = customFile.agents;

  const merged: Record<string, AgentPersona> = {};

  // Process built-in agents
  for (const [id, config] of Object.entries(defaults)) {
    const custom = customs[id] ?? {};
    if (custom.disabled) continue;
    merged[id] = { id, ...config, ...custom } as AgentPersona;
  }

  // Process custom-only agents (extends or brand-new)
  for (const [id, config] of Object.entries(customs)) {
    if (id in merged) continue; // Already processed above
    if (config.disabled) continue;

    if (config.extends) {
      // Extending a disabled or nonexistent agent is an error
      const base = merged[config.extends];
      if (!base) throw new Error(`extends target "${config.extends}" not found or is disabled`);
      merged[id] = { ...base, ...config, id, extends: undefined } as AgentPersona;
    } else {
      // New custom agent without extends must have all required fields
      const { name, emoji, tools, systemPrompt } = config;
      if (!name || !emoji || !tools || !systemPrompt) {
        throw new Error(
          `custom agent "${id}" is missing required fields: name, emoji, tools, systemPrompt`
        );
      }
      merged[id] = { id, ...config } as AgentPersona;
    }
  }

  return merged;
}

/**
 * Inject memory into an agent's system prompt.
 * Prepends project memory (project.md), team retrospectives (lessons.md),
 * and the agent's personal memory (agents/{id}.md) in that order.
 */
export function buildSystemPromptWithMemory(persona: AgentPersona, relayDir: string): string {
  const memoryPath = join(relayDir, "memory", "agents", `${persona.id}.md`);
  const projectPath = join(relayDir, "memory", "project.md");
  const lessonsPath = join(relayDir, "memory", "lessons.md");

  const agentMemory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : null;
  const projectMemory = existsSync(projectPath) ? readFileSync(projectPath, "utf-8") : null;
  const lessonsMemory = existsSync(lessonsPath) ? readFileSync(lessonsPath, "utf-8") : null;

  const parts: string[] = [
    projectMemory ? `## Project Memory\n\n${projectMemory}` : null,
    lessonsMemory ? `## Team Retrospectives & Decision History\n\n${lessonsMemory}` : null,
    agentMemory ? `## My Memory (learned from previous sessions)\n\n${agentMemory}` : null,
  ].filter((s): s is string => s !== null);

  if (parts.length === 0) return persona.systemPrompt;

  return `${parts.join("\n\n---\n\n")}\n\n---\n\n${persona.systemPrompt}`;
}

/**
 * Load workflow configuration.
 * If a custom workflow.jobs override exists, merge it with the defaults at the job level.
 */
export function getWorkflow(override?: AgentsFile): WorkflowConfig {
  const defaultFile = parseDefaultYml();

  const customFile = override ??
    readYml(join(RELAY_DIR, "agents.yml")) ??
    readYml(join(PROJECT_ROOT, "agents.yml")) ?? { agents: {} };

  const defaultJobs = defaultFile.workflow?.jobs ?? {};
  const customJobs = customFile.workflow?.jobs ?? {};

  // Override at the job level (merge individual job fields)
  const mergedJobs = { ...defaultJobs };
  for (const [jobId, jobOverride] of Object.entries(customJobs)) {
    mergedJobs[jobId] = { ...mergedJobs[jobId], ...jobOverride };
  }

  return { jobs: mergedJobs };
}
