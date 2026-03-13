// src/tools/sessions.ts
// 세션 요약을 파일로 저장하고 조회하는 툴
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 세션 요약, 태스크, 메시지를 파일로 저장.
 * .relay/sessions/{session_id}/ 디렉토리에 저장.
 */
export async function handleSaveSessionSummary(
  relayDir: string,
  input: { session_id: string; summary: string; tasks: unknown[]; messages: unknown[] }
) {
  try {
    const dir = join(relayDir, "sessions", input.session_id);
    mkdirSync(dir, { recursive: true });

    await Bun.write(
      join(dir, "summary.md"),
      `# 세션 요약: ${input.session_id}\n\n${input.summary}\n`
    );
    await Bun.write(join(dir, "tasks.json"), JSON.stringify(input.tasks, null, 2));
    await Bun.write(join(dir, "messages.json"), JSON.stringify(input.messages, null, 2));

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 세션 목록 조회 (최신순 정렬).
 * 디렉토리만 세션으로 인식.
 */
export async function handleListSessions(relayDir: string) {
  try {
    const sessionsDir = join(relayDir, "sessions");
    if (!existsSync(sessionsDir)) return { success: true, sessions: [] };
    // withFileTypes로 파일과 디렉토리를 구분 — 디렉토리만 세션으로 인식
    const sessions = readdirSync(sessionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse(); // 최신순
    return { success: true, sessions };
  } catch (err) {
    return { success: false, sessions: [], error: String(err) };
  }
}

// 세션 요약 조회 결과 타입
type SessionSummaryResult = { success: true; summary: string } | { success: false; error: string };

/**
 * 특정 세션의 요약(summary.md) 조회.
 * 존재하지 않으면 error 반환.
 */
export async function handleGetSessionSummary(
  relayDir: string,
  input: { session_id: string }
): Promise<SessionSummaryResult> {
  try {
    const summaryPath = join(relayDir, "sessions", input.session_id, "summary.md");
    if (!existsSync(summaryPath)) return { success: false, error: "세션을 찾을 수 없습니다" };
    return { success: true, summary: await Bun.file(summaryPath).text() };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
