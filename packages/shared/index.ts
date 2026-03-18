// packages/shared/index.ts
type Brand<T, B> = T & { __brand: B };

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "critical" | "high" | "medium" | "low";

// AgentId is a branded string — cast from raw YAML keys at the loader boundary
export type AgentId = Brand<string, "AgentId">;
export const markAsAgentId = (id: string): AgentId => id as AgentId;

// Timestamp unit conventions:
// - outer envelope timestamp field: milliseconds (Date.now())
// - message payload created_at sub-field: seconds (Unix epoch)
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
        /** Arbitrary key-value metadata attached via send_message */
        metadata: Record<string, string> | null;
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
        status: TaskStatus;
        priority: TaskPriority;
        description: string | null;
        /** IDs of tasks that must be done before this task can start (empty array if none) */
        depends_on: string[];
        /** Parent task ID for derived tasks, null for root tasks */
        parent_task_id: string | null;
        /** Nesting depth: 0 = root task, 1 = derived from root */
        depth: number;
        /** Human-readable reason why this task was derived from its parent, null for root tasks */
        derived_reason: string | null;
        /** Unix seconds — task creation timestamp */
        created_at: number;
        /** Unix seconds — last update timestamp */
        updated_at: number;
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
      type: "review:updated";
      review: {
        id: string;
        status: "approved" | "changes_requested";
        reviewer: string;
        comments: string | null;
      };
      timestamp: number;
    }
  | {
      type: "session:snapshot";
      /** Session ID this snapshot belongs to — for multi-server/reconnect disambiguation */
      sessionId: string;
      tasks: Array<{
        id: string;
        title: string;
        assignee: string | null;
        status: TaskStatus;
        priority: TaskPriority;
        description: string | null;
        /** IDs of tasks that must be done before this task can start (empty array if none) */
        depends_on: string[];
        /** Parent task ID for derived tasks, null for root tasks */
        parent_task_id: string | null;
        /** Nesting depth: 0 = root task, 1 = derived from root */
        depth: number;
        /** Human-readable reason why this task was derived from its parent, null for root tasks */
        derived_reason: string | null;
        /** Unix seconds — task creation timestamp */
        created_at: number;
        /** Unix seconds — last update timestamp */
        updated_at: number;
      }>;
      messages: Array<{
        id: string;
        from_agent: string;
        to_agent: string | null;
        content: string;
        thread_id: string | null;
        metadata: Record<string, string> | null;
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
  | { type: "memory:updated"; agentId: AgentId; timestamp: number }
  | {
      type: "session:started";
      sessionId: string;
      timestamp: number;
    }
  | {
      // Emitted the first time an agent_id is seen in a session (via hook or tool call).
      // Lets the dashboard show a "joined" notification and hydrate agent cards reactively.
      type: "agent:joined";
      agentId: AgentId;
      /** Agent display name — resolved from session/pool agents when available */
      name?: string;
      /** Agent emoji — resolved from session/pool agents when available */
      emoji?: string;
      sessionId: string;
      timestamp: number;
    };
