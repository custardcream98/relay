// packages/server/src/agents/types.ts
// Agent persona type definitions

// AgentId is defined once in @custardcream/relay-shared — re-exported here for convenience
import type { AgentId } from "@custardcream/relay-shared";
export type { AgentId };

export interface AgentConfig {
  name: string;
  emoji: string;
  description?: string;
  tools: string[]; // list of MCP tools allowed for this agent
  systemPrompt: string;
  language?: string; // Force response language (e.g. "Korean", "English", "Japanese")
  disabled?: boolean; // when true, this agent is excluded from the registry
  extends?: string; // inherit another agent's config and override
  tags?: string[]; // taxonomy tags for pool-based team selection (e.g. ["frontend", "web"])
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
  agents: Record<string, Partial<AgentConfig>>;
  workflow?: WorkflowConfig;
  language?: string; // Default language for all agents (can be overridden per agent)
}

// Fully resolved persona returned by loader after merging defaults and custom overrides
export interface AgentPersona extends AgentConfig {
  id: AgentId;
  tags?: string[]; // Optional taxonomy tags for pool-based team selection (e.g. ["frontend", "web"])
}
