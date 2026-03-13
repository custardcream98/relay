// src/tools/memory.ts
// 에이전트 기억(메모리)을 Markdown 파일로 읽고 쓰는 툴
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// 에이전트별 메모리 파일 경로
function agentMemoryPath(relayDir: string, agentId: string): string {
  return join(relayDir, "memory", "agents", `${agentId}.md`);
}

// 프로젝트 공통 메모리 파일 경로
function projectMemoryPath(relayDir: string): string {
  return join(relayDir, "memory", "project.md");
}

// 팀 회고/의사결정 히스토리 파일 경로
function lessonsMemoryPath(relayDir: string): string {
  return join(relayDir, "memory", "lessons.md");
}

// memory/agents 디렉토리 생성 보장
function ensureDir(relayDir: string): void {
  mkdirSync(join(relayDir, "memory", "agents"), { recursive: true });
}

/**
 * 메모리 조회.
 * agent_id 없으면 project.md + lessons.md 합쳐서 반환.
 * agent_id 있으면 해당 에이전트 파일 반환 (없으면 null).
 */
export async function handleReadMemory(
  relayDir: string,
  input: { agent_id?: string }
) {
  // agent_id 없으면 project.md + lessons.md 합쳐서 반환
  if (!input.agent_id) {
    const project = existsSync(projectMemoryPath(relayDir))
      ? readFileSync(projectMemoryPath(relayDir), "utf-8")
      : null;
    const lessons = existsSync(lessonsMemoryPath(relayDir))
      ? readFileSync(lessonsMemoryPath(relayDir), "utf-8")
      : null;
    const content =
      [project, lessons].filter((s): s is string => s !== null).join("\n\n---\n\n") || null;
    return { success: true, content };
  }

  const path = agentMemoryPath(relayDir, input.agent_id);
  if (!existsSync(path)) return { success: true, content: null };
  return { success: true, content: readFileSync(path, "utf-8") };
}

/**
 * 메모리 섹션 저장(덮어쓰기).
 * agent_id 없으면 project.md, 있으면 해당 에이전트 파일에 저장.
 * 같은 key 섹션이 이미 있으면 교체, 없으면 추가.
 */
export async function handleWriteMemory(
  relayDir: string,
  input: { agent_id?: string; key: string; content: string }
) {
  ensureDir(relayDir);
  const path = input.agent_id
    ? agentMemoryPath(relayDir, input.agent_id)
    : projectMemoryPath(relayDir);

  const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";

  // key 섹션 교체 또는 추가
  const section = `\n## ${input.key}\n\n${input.content}\n`;
  const checkPattern = new RegExp(`\n## ${input.key}\n`);
  const replacePattern = new RegExp(`\n## ${input.key}\n[\\s\\S]*?(?=\n## |$)`, "g");
  const updated = checkPattern.test(existing)
    ? existing.replace(replacePattern, section)
    : existing + section;

  writeFileSync(path, updated.trim() + "\n");
  return { success: true };
}

/**
 * 메모리 누적 추가(append).
 * agent_id 없으면 팀 공유 lessons.md에 누적.
 * agent_id 있으면 해당 에이전트 파일에 타임스탬프와 함께 추가.
 */
export async function handleAppendMemory(
  relayDir: string,
  input: { agent_id?: string; content: string }
) {
  ensureDir(relayDir);
  // agent_id 없으면 팀 공유 lessons.md에 누적 (project.md는 write_memory로만 갱신)
  const path = input.agent_id
    ? agentMemoryPath(relayDir, input.agent_id)
    : lessonsMemoryPath(relayDir);

  const timestamp = new Date().toISOString().split("T")[0];
  const entry = `\n---\n_${timestamp}_\n\n${input.content}\n`;

  const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
  writeFileSync(path, existing + entry);
  return { success: true };
}
