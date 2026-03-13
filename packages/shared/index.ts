// packages/shared/index.ts
// AgentId is a string — users can add custom agents in agents.yml, so a closed union is not possible
export type AgentId = string;

// Timestamp unit conventions:
// - outer envelope timestamp field: milliseconds (Date.now())
// - message payload created_at sub-field: seconds (Unix epoch, matching SQLite unixepoch())
export type RelayEvent =
  | { type: "agent:thinking"; agentId: AgentId; chunk: string; timestamp: number }
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
      review: { id: string; artifact_id: string; reviewer: string; requester: string };
      timestamp: number;
    }
  | {
      type: "session:snapshot";
      tasks: unknown[];
      messages: unknown[];
      artifacts: unknown[];
      timestamp: number;
    }
  | { type: "memory:updated"; agentId: AgentId; timestamp: number };
