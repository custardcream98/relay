// src/agents/types.ts
// 에이전트 페르소나 관련 타입 정의

// AgentId is defined once in shared/types.ts — re-exported here for convenience
import type { AgentId } from "../../shared/types.ts";
export type { AgentId };

export interface AgentConfig {
  name: string;
  emoji: string;
  description?: string;
  tools: string[]; // 이 에이전트에게 허용할 MCP 툴 목록
  systemPrompt: string;
  disabled?: boolean; // true면 이 에이전트 비활성화
  extends?: string; // 다른 에이전트 설정 상속 후 오버라이드
}

export interface WorkflowJob {
  agents?: string[]; // 이 job에서 실행할 에이전트 목록 (병렬 실행)
  description: string; // 자연어 job 설명. 에이전트 system prompt에 주입됨
  end?: Record<string, string>; // { nextJobId: 자연어 조건 } — _done은 세션 종료
  reviewers?: Record<string, string[]>; // { 작업에이전트: [리뷰어 목록] }
}

export interface WorkflowConfig {
  jobs: Record<string, WorkflowJob>;
}

export interface AgentsFile {
  agents: Record<AgentId, Partial<AgentConfig>>;
  workflow?: WorkflowConfig;
}

// loader가 merge 후 반환하는 완성된 페르소나
export interface AgentPersona extends AgentConfig {
  id: AgentId;
}
