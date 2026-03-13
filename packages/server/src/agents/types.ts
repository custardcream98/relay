// packages/server/src/agents/types.ts
// Agent persona type definitions

// AgentId is defined once in @relay/shared — re-exported here for convenience
import type { AgentId } from "@relay/shared";
export type { AgentId };

export interface AgentConfig {
  name: string;
  emoji: string;
  description?: string;
  tools: string[]; // list of MCP tools allowed for this agent
  systemPrompt: string;
  disabled?: boolean; // when true, this agent is excluded from the registry
  extends?: string; // inherit another agent's config and override
}

export interface WorkflowJob {
  agents?: string[]; // agents to run in this job (executed in parallel)
  description: string; // natural-language job description, injected into agent system prompts
  end?: Record<string, string>; // { nextJobId: natural-language condition } — _done means session end
  reviewers?: Record<string, string[]>; // { workingAgent: [reviewer list] }
}

export interface WorkflowConfig {
  jobs: Record<string, WorkflowJob>;
}

export interface AgentsFile {
  agents: Record<AgentId, Partial<AgentConfig>>;
  workflow?: WorkflowConfig;
}

// Fully resolved persona returned by loader after merging defaults and custom overrides
export interface AgentPersona extends AgentConfig {
  id: AgentId;
}
