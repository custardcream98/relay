// src/tools/memory.ts
// 에이전트 기억(메모리)을 Markdown 파일로 읽고 쓰는 툴
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// agent_id 검증 — 경로 순회(path traversal) 방지
function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// 메모리 키 검증 — 섹션 헤더 삽입 공격 방지 (줄바꿈 불가)
function isValidMemoryKey(key: string): boolean {
  return key.length > 0 && !key.includes("\n") && !key.includes("\r");
}

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
export async function handleReadMemory(relayDir: string, input: { agent_id?: string }) {
  // agent_id가 있으면 경로 순회 방지를 위해 검증
  if (input.agent_id !== undefined && !isValidId(input.agent_id)) {
    return { success: false, content: null, error: "유효하지 않은 ID 형식" };
  }
  try {
    // agent_id 없으면 project.md + lessons.md 합쳐서 반환
    if (!input.agent_id) {
      const project = existsSync(projectMemoryPath(relayDir))
        ? await Bun.file(projectMemoryPath(relayDir)).text()
        : null;
      const lessons = existsSync(lessonsMemoryPath(relayDir))
        ? await Bun.file(lessonsMemoryPath(relayDir)).text()
        : null;
      const content =
        [project, lessons].filter((s): s is string => s !== null).join("\n\n---\n\n") || null;
      return { success: true, content };
    }

    const path = agentMemoryPath(relayDir, input.agent_id);
    if (!existsSync(path)) return { success: true, content: null };
    return { success: true, content: await Bun.file(path).text() };
  } catch (err) {
    return { success: false, content: null, error: String(err) };
  }
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
  // agent_id가 있으면 경로 순회 방지를 위해 검증
  if (input.agent_id !== undefined && !isValidId(input.agent_id)) {
    return { success: false, error: "유효하지 않은 ID 형식" };
  }
  // key 검증 — 줄바꿈 문자 포함 시 섹션 헤더가 오염될 수 있음
  if (!isValidMemoryKey(input.key)) {
    return { success: false, error: "유효하지 않은 key 형식 (줄바꿈 불가)" };
  }
  try {
    ensureDir(relayDir);
    const path = input.agent_id
      ? agentMemoryPath(relayDir, input.agent_id)
      : projectMemoryPath(relayDir);

    const existing = existsSync(path) ? await Bun.file(path).text() : "";

    // key 섹션이 있으면 교체, 없으면 추가
    // 줄 단위로 분리하여 섹션 경계를 정확하게 파악 (정규식 메타문자 문제 방지)
    const lines = existing.split("\n");
    const headerLine = `## ${input.key}`;
    const startIdx = lines.indexOf(headerLine);

    if (startIdx === -1) {
      // 섹션 없음 — 끝에 추가
      const suffix = `${existing.length > 0 ? "\n" : ""}## ${input.key}\n\n${input.content}`;
      await Bun.write(path, `${(existing.trimEnd() + suffix).trimEnd()}\n`);
    } else {
      // 다음 ## 헤더 또는 파일 끝까지 교체
      let endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith("## "));
      if (endIdx === -1) endIdx = lines.length;
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx);
      const newSection = [`## ${input.key}`, "", input.content];
      const merged = [...before, ...newSection, ...after].join("\n");
      await Bun.write(path, `${merged.trimEnd()}\n`);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
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
  // agent_id가 있으면 경로 순회 방지를 위해 검증
  if (input.agent_id !== undefined && !isValidId(input.agent_id)) {
    return { success: false, error: "유효하지 않은 ID 형식" };
  }
  try {
    ensureDir(relayDir);
    // agent_id 없으면 팀 공유 lessons.md에 누적 (project.md는 write_memory로만 갱신)
    const path = input.agent_id
      ? agentMemoryPath(relayDir, input.agent_id)
      : lessonsMemoryPath(relayDir);

    const timestamp = new Date().toISOString().split("T")[0];
    const entry = `\n---\n_${timestamp}_\n\n${input.content}\n`;

    const existing = existsSync(path) ? await Bun.file(path).text() : "";
    await Bun.write(path, existing + entry);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
