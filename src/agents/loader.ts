// src/agents/loader.ts
// agents.default.yml + agents.yml(선택적)을 로드하여 merge된 에이전트 페르소나를 반환
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { AgentPersona, AgentConfig, AgentsFile, WorkflowConfig } from "./types";

// agents.default.yml은 relay 패키지 루트에 위치 (src/agents/../../ = relay/)
// MCP 서버가 사용자 프로젝트 디렉토리에서 실행될 때도 올바른 경로를 찾기 위해
// process.cwd() 대신 import.meta.dir(현재 파일 위치) 기준으로 탐색
const RELAY_PKG_ROOT = join(import.meta.dir, "../..");

// agents.yml은 프로젝트별 커스텀 가능 → CWD(사용자 프로젝트 루트) 기준
const PROJECT_ROOT = process.cwd();

/**
 * YAML 파일을 읽어 AgentsFile로 파싱.
 * 파일이 없으면 null 반환.
 */
function readYml(path: string): AgentsFile | null {
  if (!existsSync(path)) return null;
  return yaml.load(readFileSync(path, "utf-8")) as AgentsFile;
}

/**
 * 에이전트 페르소나 로드.
 * override가 있으면 그것을 커스텀으로 사용, 없으면 agents.yml을 읽는다.
 * disabled 에이전트는 결과에서 제외.
 * extends 사용 시 지정된 에이전트의 설정을 상속 후 오버라이드.
 */
export function loadAgents(override?: AgentsFile): Record<string, AgentPersona> {
  // 1. 기본값 로드 (relay 패키지 내장)
  const defaultFile = readYml(join(RELAY_PKG_ROOT, "agents.default.yml"));
  if (!defaultFile) throw new Error("agents.default.yml 파일을 찾을 수 없습니다");

  // 2. 사용자 커스텀 로드 (없으면 빈 객체) — 프로젝트 루트 기준
  const customFile = override ?? readYml(join(PROJECT_ROOT, "agents.yml")) ?? { agents: {} };

  // 3. 기본값 + 커스텀 merge
  const defaults = defaultFile.agents;
  const customs = customFile.agents;

  const merged: Record<string, AgentPersona> = {};

  // 기본 에이전트 처리
  for (const [id, config] of Object.entries(defaults)) {
    const custom = customs[id] ?? {};
    if (custom.disabled) continue;
    merged[id] = { id, ...config, ...custom } as AgentPersona;
  }

  // 커스텀 전용 에이전트 처리 (extends 또는 신규)
  for (const [id, config] of Object.entries(customs)) {
    if (id in merged) continue;         // 이미 처리됨
    if (config.disabled) continue;

    if (config.extends) {
      // disabled된 에이전트나 존재하지 않는 에이전트를 extends하면 에러
      const base = merged[config.extends];
      if (!base) throw new Error(`extends 대상 "${config.extends}"을 찾을 수 없거나 비활성화된 에이전트입니다`);
      merged[id] = { ...base, ...config, id, extends: undefined } as AgentPersona;
    } else {
      // extends가 없는 신규 커스텀 에이전트는 필수 필드가 모두 있어야 함
      const { name, emoji, tools, systemPrompt } = config;
      if (!name || !emoji || !tools || !systemPrompt) {
        throw new Error(`커스텀 에이전트 "${id}"에 필수 필드(name, emoji, tools, systemPrompt)가 없습니다`);
      }
      merged[id] = { id, ...config } as AgentPersona;
    }
  }

  return merged;
}

/**
 * 워크플로 설정 로드.
 * 커스텀 workflow.jobs가 있으면 기본값과 job 단위로 merge.
 */
export function getWorkflow(override?: AgentsFile): WorkflowConfig {
  const defaultFile = readYml(join(RELAY_PKG_ROOT, "agents.default.yml"));
  if (!defaultFile) throw new Error("agents.default.yml 파일을 찾을 수 없습니다");

  const customFile = override ?? readYml(join(PROJECT_ROOT, "agents.yml")) ?? { agents: {} };

  const defaultJobs = defaultFile.workflow?.jobs ?? {};
  const customJobs = customFile.workflow?.jobs ?? {};

  // job 단위 오버라이드 (각 job의 필드 수준 merge)
  const mergedJobs = { ...defaultJobs };
  for (const [jobId, jobOverride] of Object.entries(customJobs)) {
    mergedJobs[jobId] = { ...mergedJobs[jobId], ...jobOverride };
  }

  return { jobs: mergedJobs };
}
