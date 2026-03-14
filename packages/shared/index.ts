// packages/shared/index.ts
type Brand<T, B> = T & { __brand: B };

// AgentId is a branded string — cast from raw YAML keys at the loader boundary
export type AgentId = Brand<string, "AgentId">;
export const markAsAgentId = (id: string): AgentId => id as AgentId;

// Timestamp unit conventions:
// - outer envelope timestamp field: milliseconds (Date.now())
// - message payload created_at sub-field: seconds (Unix epoch, matching SQLite unixepoch())
export type RelayEvent =
  | {
      type: "agent:thinking";
      agentId: AgentId;
      chunk: string;
      timestamp: number;
    }
  | {
      type: "agent:status";
      agentId: AgentId;
      status: "idle" | "working" | "waiting";
      timestamp: number;
    }
  | {
      type: "message:new";
      message: {
        id: string;
        from_agent: string;
        to_agent: string | null;
        content: string;
        thread_id: string | null;
        created_at: number;
      };
      timestamp: number;
    }
  | {
      type: "task:updated";
      task: {
        id: string;
        title: string;
        assignee: string | null;
        status: string;
        priority: string;
      };
      timestamp: number;
    }
  | {
      type: "artifact:posted";
      artifact: { id: string; name: string; type: string; created_by: string };
      timestamp: number;
    }
  | {
      type: "review:requested";
      review: {
        id: string;
        artifact_id: string;
        reviewer: string;
        requester: string;
      };
      timestamp: number;
    }
  | {
      type: "session:snapshot";
      tasks: Array<{
        id: string;
        title: string;
        assignee: string | null;
        status: string;
        priority: string;
        description: string | null;
      }>;
      messages: Array<{
        id: string;
        from_agent: string;
        to_agent: string | null;
        content: string;
        thread_id: string | null;
        created_at: number;
      }>;
      artifacts: Array<{
        id: string;
        name: string;
        type: string;
        created_by: string;
      }>;
      /** RELAY_INSTANCE env var — undefined when single-server mode */
      instanceId?: string;
      /** Actual dashboard HTTP/WS port */
      port: number;
      /** Loaded agent metadata — for SessionTeamBadge initial hydration */
      agents?: Array<{ id: string; name: string; emoji: string }>;
      timestamp: number;
    }
  | { type: "memory:updated"; agentId: AgentId; timestamp: number };
