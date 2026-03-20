// packages/server/src/agents/types.ts
// Agent persona type definitions
import type { AgentId } from "relay-shared";

/**
 * Git-hook style task lifecycle hooks. Shell commands are run by the MCP server
 * in the project root directory. Non-zero exit blocks the operation.
 * Accepts a single command string or an array of commands (run sequentially).
 */
export interface AgentHooks {
  /** Shell command(s) run BEFORE claim_task. Non-zero exit blocks claiming. */
  before_task?: string | string[];
  /** Shell command(s) run AFTER update_task(status: "done"). Non-zero exit reverts status. */
  after_task?: string | string[];
}

/** Resolved hooks after loader normalization — all commands are arrays. */
export interface ResolvedAgentHooks {
  before_task: string[];
  after_task: string[];
}

interface AgentConfig {
  name: string;
  emoji: string;
  description?: string;
  tools: string[]; // list of MCP tools allowed for this agent
  systemPrompt: string;
  language?: string; // Force response language (e.g. "Korean", "English", "Japanese")
  disabled?: boolean; // when true, this agent is excluded from the registry
  extends?: string; // inherit another agent's config and override
  tags?: string[]; // taxonomy tags for pool-based team selection (e.g. ["frontend", "web"])
  hooks?: AgentHooks | false; // false = explicit opt-out of inherited hooks
  /** Optional validation criteria injected into the agent's system prompt before task completion.
   *  Agents should verify all listed criteria before calling update_task(status: "done"). */
  validate_prompt?: string;
  /** Optional review checklist for structured code reviews (Fix-First framework).
   *  Top-level default can be overridden per agent. Injected into reviewer context at spawn time. */
  review_checklist?: string;
}

export interface AgentsFile {
  agents: Record<string, Partial<AgentConfig>>;
  language?: string; // Default language for all agents (can be overridden per agent)
  shared_blocks?: Record<string, string>; // Reusable text blocks for systemPrompt templates — {{block_name}} in prompts
  review_checklist?: string; // Default review checklist for all agents (can be overridden per agent)
}

// Fully resolved persona returned by loader after merging defaults and custom overrides
export interface AgentPersona extends Omit<AgentConfig, "hooks"> {
  id: AgentId;
  tags?: string[]; // Optional taxonomy tags for pool-based team selection (e.g. ["frontend", "web"])
  basePersonaId?: string; // Set when this agent was created via `extends` — holds the base persona ID
  /** Resolved hooks: string | string[] normalized to string[], false normalized to undefined. */
  hooks?: ResolvedAgentHooks;
}
