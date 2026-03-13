import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  handleReadMemory,
  handleWriteMemory,
  handleAppendMemory,
} from "./memory";

const TEST_DIR = join(import.meta.dir, "../../.relay-test");

describe("메모리 툴", () => {
  beforeEach(() => mkdirSync(join(TEST_DIR, "memory/agents"), { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  test("write_memory: 에이전트 기억 저장", async () => {
    const result = await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: "conventions",
      content: "항상 서버/클라이언트 컴포넌트를 분리한다",
    });
    expect(result.success).toBe(true);
    expect(existsSync(join(TEST_DIR, "memory/agents/fe.md"))).toBe(true);
  });

  test("read_memory: 저장된 기억 조회", async () => {
    await handleWriteMemory(TEST_DIR, {
      agent_id: "be",
      key: "api-pattern",
      content: "모든 응답은 { data, error } 구조",
    });
    const result = await handleReadMemory(TEST_DIR, { agent_id: "be" });
    expect(result.success).toBe(true);
    expect(result.content).toContain("모든 응답은 { data, error } 구조");
  });

  test("read_memory: 존재하지 않으면 null 반환", async () => {
    const result = await handleReadMemory(TEST_DIR, { agent_id: "da" });
    expect(result.success).toBe(true);
    expect(result.content).toBeNull();
  });

  test("append_memory: 기억 누적 추가", async () => {
    await handleWriteMemory(TEST_DIR, { agent_id: "qa", key: "init", content: "첫 번째 기억" });
    await handleAppendMemory(TEST_DIR, { agent_id: "qa", content: "두 번째 기억" });
    const result = await handleReadMemory(TEST_DIR, { agent_id: "qa" });
    expect(result.content).toContain("첫 번째 기억");
    expect(result.content).toContain("두 번째 기억");
  });

  test("append_memory: agent_id 없으면 lessons.md에 저장", async () => {
    await handleAppendMemory(TEST_DIR, { content: "팀 회고: auth 헤더 주의" });
    expect(existsSync(join(TEST_DIR, "memory/lessons.md"))).toBe(true);
    // project.md에는 쓰이지 않아야 함
    expect(existsSync(join(TEST_DIR, "memory/project.md"))).toBe(false);
  });

  test("read_memory: agent_id 없으면 project + lessons 합쳐서 반환", async () => {
    await handleWriteMemory(TEST_DIR, { key: "summary", content: "프로젝트 요약" });
    await handleAppendMemory(TEST_DIR, { content: "lessons 내용" });
    const result = await handleReadMemory(TEST_DIR, {});
    expect(result.content).toContain("프로젝트 요약");
    expect(result.content).toContain("lessons 내용");
  });
});
