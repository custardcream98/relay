import { beforeEach, describe, expect, test } from "bun:test";
import { _resetStore } from "../store";
import {
  handleClaimTask,
  handleCreateTask,
  handleGetAllTasks,
  handleGetMyTasks,
  handleGetTeamStatus,
  handleUpdateTask,
} from "./tasks";

describe("tasks tool", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("create_task: creates a task", async () => {
    const result = await handleCreateTask("sess-1", {
      agent_id: "pm",
      title: "Design shopping cart API",
      description: "Write REST API endpoint specification",
      assignee: "be",
      priority: "high",
    });
    expect(result.success).toBe(true);
    expect(result.task_id).toBeDefined();
  });

  test("update_task: updates status", async () => {
    const { task_id } = await handleCreateTask("sess-1", {
      agent_id: "pm",
      title: "test task",
      assignee: "fe",
      priority: "medium",
    });
    const result = await handleUpdateTask("sess-1", {
      agent_id: "fe",
      task_id: task_id as string,
      status: "in_progress",
    });
    expect(result.success).toBe(true);
  });

  test("get_my_tasks: returns only own tasks", async () => {
    await handleCreateTask("sess-1", {
      agent_id: "pm",
      title: "FE task",
      assignee: "fe",
      priority: "low",
    });
    await handleCreateTask("sess-1", {
      agent_id: "pm",
      title: "BE task",
      assignee: "be",
      priority: "low",
    });

    const result = await handleGetMyTasks("sess-1", { agent_id: "fe" });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("FE task");
  });

  describe("claim_task", () => {
    test("succeeds when claiming own todo task", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "FE implementation",
        assignee: "fe",
        priority: "high",
      });
      const result = await handleClaimTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(true);
    });

    test("fails when re-claiming an already in_progress task", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "FE implementation",
        assignee: "fe",
        priority: "high",
      });
      await handleClaimTask("sess-1", { agent_id: "fe", task_id: task_id as string });
      const result = await handleClaimTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(false);
    });

    test("fails when claiming another agent's task", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "BE implementation",
        assignee: "be",
        priority: "medium",
      });
      const result = await handleClaimTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(false);
    });

    test("any agent can claim an unassigned task", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "shared task",
        priority: "low",
      });
      const result = await handleClaimTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(true);
    });

    test("can claim task with no depends_on (regression)", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "independent task",
        assignee: "fe",
        priority: "high",
      });
      const result = await handleClaimTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(true);
    });

    test("can claim task when all depends_on are done", async () => {
      const { task_id: depId } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "prerequisite task",
        assignee: "be",
        priority: "high",
      });
      await handleUpdateTask("sess-1", {
        agent_id: "be",
        task_id: depId as string,
        status: "done",
      });
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "dependent task",
        assignee: "fe",
        priority: "medium",
        depends_on: [depId as string],
      });
      const result = await handleClaimTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(true);
    });

    test("cannot claim task when a depends_on is still 'todo'", async () => {
      const { task_id: depId } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "unfinished prerequisite",
        assignee: "be",
        priority: "high",
      });
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "blocked task",
        assignee: "fe",
        priority: "medium",
        depends_on: [depId as string],
      });
      const result = await handleClaimTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(false);
      expect(result.reason).toContain(depId as string);
    });

    test("before_task hook failure blocks claiming (task stays todo)", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "hook-guarded task",
        assignee: "fe",
        priority: "high",
      });
      const result = await handleClaimTask(
        "sess-1",
        { agent_id: "fe", task_id: task_id as string },
        { before_task: ["exit 1"], after_task: [] }
      );
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(false);
      expect(result.reason).toContain("before_task hook failed");
      // Task must remain todo — no phantom in_progress
      const { tasks } = await handleGetAllTasks("sess-1", { agent_id: "fe" });
      expect(tasks[0].status).toBe("todo");
    });

    test("before_task hook success allows claiming", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "hook-guarded task",
        assignee: "fe",
        priority: "high",
      });
      const result = await handleClaimTask(
        "sess-1",
        { agent_id: "fe", task_id: task_id as string },
        { before_task: ["echo ok"], after_task: [] }
      );
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(true);
    });

    test("cannot claim task when a depends_on is still 'in_progress'", async () => {
      const { task_id: depId } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "in-progress prerequisite",
        assignee: "be",
        priority: "high",
      });
      await handleUpdateTask("sess-1", {
        agent_id: "be",
        task_id: depId as string,
        status: "in_progress",
      });
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "blocked task",
        assignee: "fe",
        priority: "medium",
        depends_on: [depId as string],
      });
      const result = await handleClaimTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(false);
      expect(result.reason).toContain(depId as string);
    });
  });

  describe("update_task hooks", () => {
    test("after_task hook failure reverts status to in_review", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "task with after hook",
        assignee: "fe",
        priority: "high",
      });
      // Move to in_progress first
      await handleClaimTask("sess-1", { agent_id: "fe", task_id: task_id as string });
      // Attempt to mark done — hook fails
      const result = await handleUpdateTask(
        "sess-1",
        { agent_id: "fe", task_id: task_id as string, status: "done" },
        { before_task: [], after_task: ["exit 1"] }
      );
      expect(result.success).toBe(false);
      // hook_failed discriminates "hook blocked done" from "task not found" (no hook_failed)
      expect((result as Record<string, unknown>).hook_failed).toBe(true);
      expect(result.error).toContain("after_task hook failed");
      // Status must be reverted to in_review
      const { tasks } = await handleGetAllTasks("sess-1", { agent_id: "fe" });
      expect(tasks[0].status).toBe("in_review");
    });

    test("after_task hook failure → retry with passing hook succeeds", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "task with retryable after hook",
        assignee: "fe",
        priority: "high",
      });
      await handleClaimTask("sess-1", { agent_id: "fe", task_id: task_id as string });
      // First attempt: hook fails, status reverted to in_review
      await handleUpdateTask(
        "sess-1",
        { agent_id: "fe", task_id: task_id as string, status: "done" },
        { before_task: [], after_task: ["exit 1"] }
      );
      // Second attempt: hook passes, status should reach done
      const retry = await handleUpdateTask(
        "sess-1",
        { agent_id: "fe", task_id: task_id as string, status: "done" },
        { before_task: [], after_task: ["echo ok"] }
      );
      expect(retry.success).toBe(true);
      const { tasks } = await handleGetAllTasks("sess-1", { agent_id: "fe" });
      expect(tasks[0].status).toBe("done");
    });

    test("after_task hook success keeps status as done", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "task with passing after hook",
        assignee: "fe",
        priority: "high",
      });
      await handleClaimTask("sess-1", { agent_id: "fe", task_id: task_id as string });
      const result = await handleUpdateTask(
        "sess-1",
        { agent_id: "fe", task_id: task_id as string, status: "done" },
        { before_task: [], after_task: ["echo ok"] }
      );
      expect(result.success).toBe(true);
      const { tasks } = await handleGetAllTasks("sess-1", { agent_id: "fe" });
      expect(tasks[0].status).toBe("done");
    });

    test("after_task hook is NOT triggered for non-done status updates", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "task",
        assignee: "fe",
        priority: "low",
      });
      // This would fail if the hook ran, but status is not "done"
      const result = await handleUpdateTask(
        "sess-1",
        { agent_id: "fe", task_id: task_id as string, status: "in_progress" },
        { before_task: [], after_task: ["exit 1"] }
      );
      expect(result.success).toBe(true);
    });
  });

  describe("get_team_status", () => {
    test("empty session → all zeros, has_pending_work false", async () => {
      const result = await handleGetTeamStatus("sess-1", { agent_id: "pm" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.todo).toBe(0);
      expect(result.in_progress).toBe(0);
      expect(result.in_review).toBe(0);
      expect(result.done).toBe(0);
      expect(result.total).toBe(0);
      expect(result.has_pending_work).toBe(false);
    });

    test("mix of todo + done → has_pending_work true", async () => {
      await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "task 1",
        assignee: "fe",
        priority: "high",
      });
      const { task_id: t2 } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "task 2",
        assignee: "be",
        priority: "medium",
      });
      await handleUpdateTask("sess-1", {
        agent_id: "be",
        task_id: t2 as string,
        status: "done",
      });
      const result = await handleGetTeamStatus("sess-1", { agent_id: "qa" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.todo).toBe(1);
      expect(result.done).toBe(1);
      expect(result.total).toBe(2);
      expect(result.has_pending_work).toBe(true);
    });

    test("all done → has_pending_work false", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "task",
        assignee: "fe",
        priority: "low",
      });
      await handleUpdateTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
        status: "done",
      });
      const result = await handleGetTeamStatus("sess-1", { agent_id: "deployer" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.todo).toBe(0);
      expect(result.has_pending_work).toBe(false);
    });

    test("session isolation — tasks from other sessions are not counted", async () => {
      await handleCreateTask("sess-other", {
        agent_id: "pm",
        title: "other session task",
        priority: "high",
      });
      const result = await handleGetTeamStatus("sess-1", { agent_id: "pm" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.total).toBe(0);
    });
  });

  describe("get_all_tasks", () => {
    test("returns all tasks in session regardless of assignee", async () => {
      await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "FE task",
        assignee: "fe",
        priority: "high",
      });
      await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "BE task",
        assignee: "be",
        priority: "medium",
      });
      const result = await handleGetAllTasks("sess-1", { agent_id: "qa" });
      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(2);
    });

    test("tasks from other sessions are not included", async () => {
      await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "session 1 task",
        priority: "low",
      });
      await handleCreateTask("sess-other", {
        agent_id: "pm",
        title: "session 2 task",
        priority: "low",
      });
      const result = await handleGetAllTasks("sess-1", { agent_id: "pm" });
      expect(result.tasks).toHaveLength(1);
    });

    test("status filter returns only tasks with matching status", async () => {
      await handleCreateTask("sess-1", { agent_id: "pm", title: "todo task", priority: "low" });
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "done task",
        priority: "low",
      });
      await handleUpdateTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
        status: "done",
      });
      const result = await handleGetAllTasks("sess-1", { agent_id: "qa", status: "done" });
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe("done task");
    });
  });

  describe("update_task no valid fields guard", () => {
    test("returns error when no valid fields are provided", async () => {
      const { task_id } = await handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "task",
        priority: "low",
      });
      const result = await handleUpdateTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
      });
      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain("No valid fields");
    });
  });
});
