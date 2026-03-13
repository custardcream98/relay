import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "../db/schema";
import {
  handleClaimTask,
  handleCreateTask,
  handleGetAllTasks,
  handleGetMyTasks,
  handleGetTeamStatus,
  handleUpdateTask,
} from "./tasks";

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

  describe("claim_task", () => {
    test("todo 상태의 내 태스크 클레임 성공", async () => {
      const { task_id } = await handleCreateTask(db, "sess-1", {
        agent_id: "pm",
        title: "FE 구현",
        assignee: "fe",
        priority: "high",
      });
      const result = await handleClaimTask(db, "sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(true);
    });

    test("이미 in_progress인 태스크 재클레임 실패", async () => {
      const { task_id } = await handleCreateTask(db, "sess-1", {
        agent_id: "pm",
        title: "FE 구현",
        assignee: "fe",
        priority: "high",
      });
      await handleClaimTask(db, "sess-1", { agent_id: "fe", task_id: task_id as string });
      const result = await handleClaimTask(db, "sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(false);
    });

    test("다른 에이전트 소유 태스크 클레임 실패", async () => {
      const { task_id } = await handleCreateTask(db, "sess-1", {
        agent_id: "pm",
        title: "BE 구현",
        assignee: "be",
        priority: "medium",
      });
      const result = await handleClaimTask(db, "sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(false);
    });

    test("assignee 없는 태스크는 누구든 클레임 가능", async () => {
      const { task_id } = await handleCreateTask(db, "sess-1", {
        agent_id: "pm",
        title: "공통 작업",
        priority: "low",
      });
      const result = await handleClaimTask(db, "sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(true);
    });
  });

  describe("get_team_status", () => {
    test("빈 세션 → 전부 0, has_pending_work false", async () => {
      const result = await handleGetTeamStatus(db, "sess-1", { agent_id: "pm" });
      expect(result.success).toBe(true);
      expect(result.todo).toBe(0);
      expect(result.in_progress).toBe(0);
      expect(result.in_review).toBe(0);
      expect(result.done).toBe(0);
      expect(result.total).toBe(0);
      expect(result.has_pending_work).toBe(false);
    });

    test("todo + done 혼재 → has_pending_work true", async () => {
      await handleCreateTask(db, "sess-1", {
        agent_id: "pm",
        title: "작업1",
        assignee: "fe",
        priority: "high",
      });
      const { task_id: t2 } = await handleCreateTask(db, "sess-1", {
        agent_id: "pm",
        title: "작업2",
        assignee: "be",
        priority: "medium",
      });
      await handleUpdateTask(db, "sess-1", {
        agent_id: "be",
        task_id: t2 as string,
        status: "done",
      });
      const result = await handleGetTeamStatus(db, "sess-1", { agent_id: "qa" });
      expect(result.todo).toBe(1);
      expect(result.done).toBe(1);
      expect(result.total).toBe(2);
      expect(result.has_pending_work).toBe(true);
    });

    test("전부 done → has_pending_work false", async () => {
      const { task_id } = await handleCreateTask(db, "sess-1", {
        agent_id: "pm",
        title: "작업",
        assignee: "fe",
        priority: "low",
      });
      await handleUpdateTask(db, "sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
        status: "done",
      });
      const result = await handleGetTeamStatus(db, "sess-1", { agent_id: "deployer" });
      expect(result.todo).toBe(0);
      expect(result.has_pending_work).toBe(false);
    });

    test("세션 격리 — 다른 세션 태스크는 집계되지 않음", async () => {
      await handleCreateTask(db, "sess-other", {
        agent_id: "pm",
        title: "다른 세션 작업",
        priority: "high",
      });
      const result = await handleGetTeamStatus(db, "sess-1", { agent_id: "pm" });
      expect(result.total).toBe(0);
    });
  });

  describe("get_all_tasks", () => {
    test("세션 전체 태스크 반환 (assignee 무관)", async () => {
      await handleCreateTask(db, "sess-1", {
        agent_id: "pm",
        title: "FE 작업",
        assignee: "fe",
        priority: "high",
      });
      await handleCreateTask(db, "sess-1", {
        agent_id: "pm",
        title: "BE 작업",
        assignee: "be",
        priority: "medium",
      });
      const result = await handleGetAllTasks(db, "sess-1", { agent_id: "qa" });
      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(2);
    });

    test("다른 세션 태스크는 포함되지 않음", async () => {
      await handleCreateTask(db, "sess-1", {
        agent_id: "pm",
        title: "세션1 작업",
        priority: "low",
      });
      await handleCreateTask(db, "sess-other", {
        agent_id: "pm",
        title: "세션2 작업",
        priority: "low",
      });
      const result = await handleGetAllTasks(db, "sess-1", { agent_id: "pm" });
      expect(result.tasks).toHaveLength(1);
    });
  });
});
