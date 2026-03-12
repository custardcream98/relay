// shared/types.ts
// AgentId는 string — 사용자가 agents.yml에 커스텀 에이전트를 추가할 수 있으므로 닫힌 유니온 불가
export type AgentId = string;

// 타임스탬프 단위 규칙:
// - 외부 envelope의 timestamp 필드: 밀리초 (Date.now())
// - message 페이로드의 created_at 서브필드: 초 (Unix epoch, SQLite unixepoch() 기준)
export type RelayEvent =
  | { type: "agent:thinking"; agentId: AgentId; chunk: string; timestamp: number }
  | { type: "agent:status"; agentId: AgentId; status: "idle" | "working" | "waiting"; timestamp: number }
  | { type: "message:new"; message: { id: string; from_agent: string; to_agent: string | null; content: string; thread_id: string | null; created_at: number }; timestamp: number }
  | { type: "task:updated"; task: { id: string; title: string; assignee: string | null; status: string; priority: string }; timestamp: number }
  | { type: "artifact:posted"; artifact: { id: string; name: string; type: string; created_by: string }; timestamp: number }
  | { type: "review:requested"; review: { id: string; artifact_id: string; reviewer: string; requester: string }; timestamp: number }
  | { type: "session:snapshot"; tasks: unknown[]; messages: unknown[]; artifacts: unknown[]; timestamp: number };
