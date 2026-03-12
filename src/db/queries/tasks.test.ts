import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../schema";
import { insertTask, updateTask, getTasksByAssignee, getTaskById } from "./tasks";

describe("태스크 쿼리", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("태스크 생성 및 ID 조회", () => {
    insertTask(db, {
      id: "task-1",
      session_id: "sess-1",
      title: "로그인 UI 구현",
      description: "OAuth 로그인 버튼 추가",
      assignee: "fe",
      status: "todo",
      priority: "high",
      created_by: "pm",
    });

    const task = getTaskById(db, "task-1");
    expect(task?.title).toBe("로그인 UI 구현");
    expect(task?.status).toBe("todo");
  });

  test("태스크 상태 업데이트", () => {
    insertTask(db, {
      id: "task-2",
      session_id: "sess-1",
      title: "API 설계",
      description: null,
      assignee: "be",
      status: "todo",
      priority: "medium",
      created_by: "pm",
    });

    updateTask(db, "task-2", { status: "in_progress" });
    const task = getTaskById(db, "task-2");
    expect(task?.status).toBe("in_progress");
  });

  test("담당자별 태스크 조회", () => {
    insertTask(db, { id: "t1", session_id: "s1", title: "FE 작업", description: null, assignee: "fe", status: "todo", priority: "medium", created_by: "pm" });
    insertTask(db, { id: "t2", session_id: "s1", title: "BE 작업", description: null, assignee: "be", status: "todo", priority: "medium", created_by: "pm" });

    const feTasks = getTasksByAssignee(db, "s1", "fe");
    expect(feTasks).toHaveLength(1);
    expect(feTasks[0].title).toBe("FE 작업");
  });

  test("updateTask: 빈 updates 전달 시 에러 없이 종료 (SQL 오류 방지)", () => {
    insertTask(db, {
      id: "task-3",
      session_id: "sess-1",
      title: "빈 업데이트 테스트",
      description: null,
      assignee: "fe",
      status: "todo",
      priority: "medium",
      created_by: "pm",
    });
    expect(() => updateTask(db, "task-3", {})).not.toThrow();
  });
});
