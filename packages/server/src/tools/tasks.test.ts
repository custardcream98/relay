import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "../db/schema";
import { handleCreateTask, handleGetMyTasks, handleUpdateTask } from "./tasks";

describe("tasks 툴", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("create_task: 태스크 생성", async () => {
    const result = await handleCreateTask(db, "sess-1", {
      agent_id: "pm",
      title: "쇼핑카트 API 설계",
      description: "REST API 엔드포인트 명세 작성",
      assignee: "be",
      priority: "high",
    });
    expect(result.success).toBe(true);
    expect(result.task_id).toBeDefined();
  });

  test("update_task: 상태 변경", async () => {
    const { task_id } = await handleCreateTask(db, "sess-1", {
      agent_id: "pm",
      title: "테스트",
      assignee: "fe",
      priority: "medium",
    });
    const result = await handleUpdateTask(db, "sess-1", {
      agent_id: "fe",
      task_id: task_id as string,
      status: "in_progress",
    });
    expect(result.success).toBe(true);
  });

  test("get_my_tasks: 내 태스크만 조회", async () => {
    await handleCreateTask(db, "sess-1", {
      agent_id: "pm",
      title: "FE 작업",
      assignee: "fe",
      priority: "low",
    });
    await handleCreateTask(db, "sess-1", {
      agent_id: "pm",
      title: "BE 작업",
      assignee: "be",
      priority: "low",
    });

    const result = await handleGetMyTasks(db, "sess-1", { agent_id: "fe" });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("FE 작업");
  });
});
