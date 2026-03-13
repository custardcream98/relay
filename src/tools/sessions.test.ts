import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { handleSaveSessionSummary, handleListSessions, handleGetSessionSummary } from "./sessions";

const TEST_DIR = join(import.meta.dir, "../../.relay-test");

describe("세션 툴", () => {
  beforeEach(() => mkdirSync(join(TEST_DIR, "sessions"), { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  test("세션 요약 저장", async () => {
    const result = await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "쇼핑카트 기능 구현 완료. auth 헤더 이슈 주의.",
      tasks: [{ id: "t1", title: "장바구니 UI", status: "done" }],
      messages: [{ id: "m1", from_agent: "pm", content: "작업 시작" }],
    });
    expect(result.success).toBe(true);
    // messages.json도 저장됐는지 확인
    expect(existsSync(join(TEST_DIR, "sessions/2026-03-13-001/messages.json"))).toBe(true);
  });

  test("세션 요약 조회", async () => {
    await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "테스트 요약",
      tasks: [],
      messages: [],
    });
    const result = await handleGetSessionSummary(TEST_DIR, { session_id: "2026-03-13-001" });
    expect(result.success).toBe(true);
    expect(result.summary).toContain("테스트 요약");
  });

  test("세션 목록 조회", async () => {
    await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "첫 번째 세션",
      tasks: [],
      messages: [],
    });
    const result = await handleListSessions(TEST_DIR);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toBe("2026-03-13-001");
  });
});
