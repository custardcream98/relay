import { beforeEach, describe, expect, test } from "bun:test";
import { _resetStore, getTaskById } from "../store";
import { handleClaimTask, handleCreateTask, handleGetAllTasks, handleUpdateTask } from "./tasks";

describe("tasks tool", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("create_task: creates a task", () => {
    const result = handleCreateTask("sess-1", {
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
    const { task_id } = handleCreateTask("sess-1", {
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

  describe("claim_task", () => {
    test("succeeds when claiming own todo task", async () => {
      const { task_id } = handleCreateTask("sess-1", {
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
      const { task_id } = handleCreateTask("sess-1", {
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
      const { task_id } = handleCreateTask("sess-1", {
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
      const { task_id } = handleCreateTask("sess-1", {
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
      const { task_id } = handleCreateTask("sess-1", {
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
      const { task_id: depId } = handleCreateTask("sess-1", {
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
      const { task_id } = handleCreateTask("sess-1", {
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
      const { task_id: depId } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "unfinished prerequisite",
        assignee: "be",
        priority: "high",
      });
      const { task_id } = handleCreateTask("sess-1", {
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
      const { task_id } = handleCreateTask("sess-1", {
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
      const { tasks } = handleGetAllTasks("sess-1", { agent_id: "fe" });
      expect(tasks[0].status).toBe("todo");
    });

    test("before_task hook success allows claiming", async () => {
      const { task_id } = handleCreateTask("sess-1", {
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
      const { task_id: depId } = handleCreateTask("sess-1", {
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
      const { task_id } = handleCreateTask("sess-1", {
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
      const { task_id } = handleCreateTask("sess-1", {
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
      const { tasks } = handleGetAllTasks("sess-1", { agent_id: "fe" });
      expect(tasks[0].status).toBe("in_review");
    });

    test("after_task hook failure → retry with passing hook succeeds", async () => {
      const { task_id } = handleCreateTask("sess-1", {
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
      const { tasks } = handleGetAllTasks("sess-1", { agent_id: "fe" });
      expect(tasks[0].status).toBe("done");
    });

    test("after_task hook success keeps status as done", async () => {
      const { task_id } = handleCreateTask("sess-1", {
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
      const { tasks } = handleGetAllTasks("sess-1", { agent_id: "fe" });
      expect(tasks[0].status).toBe("done");
    });

    test("after_task hook is NOT triggered for non-done status updates", async () => {
      const { task_id } = handleCreateTask("sess-1", {
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

  describe("get_all_tasks", () => {
    test("returns all tasks in session regardless of assignee", () => {
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "FE task",
        assignee: "fe",
        priority: "high",
      });
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "BE task",
        assignee: "be",
        priority: "medium",
      });
      const result = handleGetAllTasks("sess-1", { agent_id: "qa" });
      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(2);
    });

    test("tasks from other sessions are not included", () => {
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "session 1 task",
        priority: "low",
      });
      handleCreateTask("sess-other", {
        agent_id: "pm",
        title: "session 2 task",
        priority: "low",
      });
      const result = handleGetAllTasks("sess-1", { agent_id: "pm" });
      expect(result.tasks).toHaveLength(1);
    });

    test("status filter returns only tasks with matching status", async () => {
      handleCreateTask("sess-1", { agent_id: "pm", title: "todo task", priority: "low" });
      const { task_id } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "done task",
        priority: "low",
      });
      await handleUpdateTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
        status: "done",
      });
      const result = handleGetAllTasks("sess-1", { agent_id: "qa", status: "done" });
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe("done task");
    });

    test("assignee filter returns only tasks assigned to specific agent", () => {
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "FE task",
        assignee: "fe",
        priority: "low",
      });
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "BE task",
        assignee: "be",
        priority: "low",
      });
      const result = handleGetAllTasks("sess-1", { agent_id: "fe", assignee: "fe" });
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe("FE task");
    });

    test("assignee filter combined with status filter works", async () => {
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "FE todo",
        assignee: "fe",
        priority: "low",
      });
      const { task_id } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "FE done",
        assignee: "fe",
        priority: "medium",
      });
      await handleUpdateTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
        status: "done",
      });
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "BE todo",
        assignee: "be",
        priority: "low",
      });
      const result = handleGetAllTasks("sess-1", {
        agent_id: "fe",
        assignee: "fe",
        status: "done",
      });
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe("FE done");
    });

    test("assignee filter with no matches returns empty array", () => {
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "FE task",
        assignee: "fe",
        priority: "low",
      });
      const result = handleGetAllTasks("sess-1", { agent_id: "qa", assignee: "qa" });
      expect(result.tasks).toHaveLength(0);
    });
  });

  describe("update_task no valid fields guard", () => {
    test("returns error when no valid fields are provided", async () => {
      const { task_id } = handleCreateTask("sess-1", {
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

  describe("update_task ownership checks", () => {
    test("non-assignee non-creator is denied permission", async () => {
      // pm creates task assigned to fe; qa attempts to update
      const { task_id } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "assigned task",
        assignee: "fe",
        priority: "medium",
      });
      const result = await handleUpdateTask("sess-1", {
        agent_id: "qa",
        task_id: task_id as string,
        status: "in_progress",
      });
      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain("permission denied");
    });

    test("creator can update a task assigned to someone else", async () => {
      // pm creates task assigned to fe; pm (creator) updates it
      const { task_id } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "assigned task",
        assignee: "fe",
        priority: "medium",
      });
      const result = await handleUpdateTask("sess-1", {
        agent_id: "pm",
        task_id: task_id as string,
        status: "in_review",
      });
      expect(result.success).toBe(true);
    });

    test("unassigned task can be updated by any agent", async () => {
      // pm creates unassigned task; qa updates it
      const { task_id } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "unassigned task",
        priority: "low",
      });
      const result = await handleUpdateTask("sess-1", {
        agent_id: "qa",
        task_id: task_id as string,
        status: "in_progress",
      });
      expect(result.success).toBe(true);
    });

    test("assignee can update their own task", async () => {
      const { task_id } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "fe task",
        assignee: "fe",
        priority: "high",
      });
      const result = await handleUpdateTask("sess-1", {
        agent_id: "fe",
        task_id: task_id as string,
        status: "in_progress",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("handleClaimTask TOCTOU re-check after hook", () => {
    // The re-check path (reason: "re-check after hook") cannot be exercised in a synchronous
    // unit test because any reverted dependency is caught by the FIRST depends_on check before
    // the hook ever runs. Testing true TOCTOU would require injecting a store mutation inside
    // the hook process, which is not possible with a simple echo command.
    //
    // This test verifies the observable invariant: when a dependency is NOT done at call time,
    // claim is blocked regardless of whether a hook is configured. The first check is the
    // safety net that prevents the hook from running when deps are unmet.
    test("claim is blocked when dependency is not done before hook runs", async () => {
      // Create a dependency task and mark it done
      const { task_id: depId } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "dep task",
        assignee: "be",
        priority: "high",
      });
      await handleUpdateTask("sess-1", {
        agent_id: "be",
        task_id: depId as string,
        status: "done",
      });
      // Create the dependent task
      const { task_id } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "dependent task",
        assignee: "fe",
        priority: "medium",
        depends_on: [depId as string],
      });
      // Revert the dependency back to in_review before calling claimTask.
      // The first depends_on check will catch this and block the claim before the hook runs.
      await handleUpdateTask("sess-1", {
        agent_id: "be",
        task_id: depId as string,
        status: "in_review",
      });
      const result = await handleClaimTask(
        "sess-1",
        { agent_id: "fe", task_id: task_id as string },
        { before_task: ["echo ok"], after_task: [] }
      );
      // First check catches the unmet dep; the hook never runs
      expect(result.success).toBe(true);
      expect(result.claimed).toBe(false);
      expect(result.reason).toContain("Unmet dependencies");
    });
  });

  describe("create_task idempotency_key", () => {
    test("same key returns existing task_id without creating a duplicate", () => {
      const first = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "Task A",
        priority: "medium",
        idempotency_key: "unique-key-1",
      });
      const second = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "Task A (retry)",
        priority: "high",
        idempotency_key: "unique-key-1",
      });
      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(second.task_id).toBe(first.task_id);
      // Only one task should exist in the session
      const { tasks } = handleGetAllTasks("sess-1", { agent_id: "pm" });
      expect(tasks.length).toBe(1);
    });

    test("same key in different sessions creates independent tasks", () => {
      const r1 = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "Task A",
        priority: "medium",
        idempotency_key: "shared-key",
      });
      const r2 = handleCreateTask("sess-2", {
        agent_id: "pm",
        title: "Task A",
        priority: "medium",
        idempotency_key: "shared-key",
      });
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r1.task_id).not.toBe(r2.task_id);
    });

    test("omitting idempotency_key always creates a new task", () => {
      const r1 = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "Task B",
        priority: "low",
      });
      const r2 = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "Task B",
        priority: "low",
      });
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r1.task_id).not.toBe(r2.task_id);
    });

    test("key still returns same task_id after the task has been claimed", async () => {
      const { task_id } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "Task C",
        priority: "high",
        idempotency_key: "claimed-key",
      });
      await handleClaimTask("sess-1", { agent_id: "pm", task_id: task_id as string });
      const retry = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "Task C (retry)",
        priority: "high",
        idempotency_key: "claimed-key",
      });
      expect(retry.success).toBe(true);
      expect(retry.task_id).toBe(task_id);
    });
  });

  describe("derived task circuit breaker", () => {
    test("idempotency_key bypasses sibling cap on re-spawn", () => {
      // Regression: idempotency check must run BEFORE sibling validation.
      // Re-spawned agents calling create_task again must get back the existing task_id
      // even if the parent's sibling cap has since been reached by other derived tasks.
      const { task_id: parentId } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "parent",
        priority: "high",
      });
      // Agent creates the first derived child (sibling 1) with an idempotency key
      const { task_id: child1Id } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "child 1",
        priority: "low",
        parent_task_id: parentId as string,
        idempotency_key: "child-1-key",
      });
      // Other agents fill the remaining sibling slots (2 and 3 → cap reached)
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "child 2",
        priority: "low",
        parent_task_id: parentId as string,
      });
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "child 3",
        priority: "low",
        parent_task_id: parentId as string,
      });
      // Agent re-spawns and calls create_task again with the same idempotency_key.
      // Without the idempotency-first fix, sibling validation would run first and
      // return "max derived siblings exceeded" (3 siblings already exist).
      const result = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "child 1",
        priority: "low",
        parent_task_id: parentId as string,
        idempotency_key: "child-1-key",
      });
      expect(result.success).toBe(true);
      expect(result.task_id).toBe(child1Id);
    });

    test("root task has depth 0 and no parent_task_id", () => {
      const { task_id } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "root task",
        priority: "medium",
      });
      const { tasks } = handleGetAllTasks("sess-1", { agent_id: "pm" });
      const task = tasks.find((t) => t.id === task_id);
      expect(task?.depth).toBe(0);
      expect(task?.parent_task_id).toBeNull();
    });

    test("derived task has depth 1 and parent_task_id set", () => {
      const { task_id: parentId } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "parent",
        priority: "high",
      });
      const { task_id: childId } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "child",
        priority: "medium",
        parent_task_id: parentId as string,
        derived_reason: "follow-up work",
      });
      const { tasks } = handleGetAllTasks("sess-1", { agent_id: "pm", include_description: true });
      const child = tasks.find((t) => t.id === childId);
      expect(child?.depth).toBe(1);
      expect(child?.parent_task_id).toBe(parentId);
      expect(child?.derived_reason).toBe("follow-up work");
    });

    test("grandchild (depth > 1) is rejected", () => {
      const { task_id: parentId } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "parent",
        priority: "high",
      });
      const { task_id: childId } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "child",
        priority: "medium",
        parent_task_id: parentId as string,
      });
      const result = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "grandchild",
        priority: "low",
        parent_task_id: childId as string,
      });
      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain("max derived task depth exceeded");
    });

    test("4th sibling per parent is rejected", () => {
      const { task_id: parentId } = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "parent",
        priority: "high",
      });
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "child 1",
        priority: "low",
        parent_task_id: parentId as string,
      });
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "child 2",
        priority: "low",
        parent_task_id: parentId as string,
      });
      handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "child 3",
        priority: "low",
        parent_task_id: parentId as string,
      });
      const result = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "child 4",
        priority: "low",
        parent_task_id: parentId as string,
      });
      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain("max derived siblings exceeded");
    });

    test("parent_task_id pointing to non-existent task returns error", () => {
      const result = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "orphan",
        priority: "low",
        parent_task_id: "nonexistent-id",
      });
      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain("parent task not found");
    });

    test("parent_task_id from a different session returns error", () => {
      // Create a parent task in sess-2
      const parentResult = handleCreateTask("sess-2", {
        agent_id: "pm",
        title: "parent in other session",
        priority: "medium",
      });
      expect(parentResult.success).toBe(true);
      const parentId = (parentResult as { task_id: string }).task_id;

      // Attempt to create a child in sess-1 pointing to sess-2's parent
      const result = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "cross-session child",
        priority: "low",
        parent_task_id: parentId,
      });
      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain("parent task not found");
    });

    test("depends_on with valid task IDs in same session succeeds and stores the dependency", () => {
      const dep = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "prerequisite task",
        priority: "medium",
      });
      expect(dep.success).toBe(true);
      const depId = (dep as { task_id: string }).task_id;

      const result = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "dependent task",
        priority: "low",
        depends_on: [depId],
      });
      expect(result.success).toBe(true);
      const taskId = (result as { task_id: string }).task_id;

      // Verify depends_on is actually persisted in the store
      const stored = getTaskById(taskId, "sess-1");
      expect(stored).not.toBeNull();
      expect(stored?.depends_on).toEqual([depId]);
    });

    test("idempotency key bypasses depends_on validation on re-spawn", () => {
      // First call: valid dep exists — task is created
      const dep = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "dep task",
        priority: "medium",
      });
      const depId = (dep as { task_id: string }).task_id;

      const first = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "idempotent task",
        priority: "low",
        depends_on: [depId],
        idempotency_key: "idem-key-1",
      });
      expect(first.success).toBe(true);
      const originalId = (first as { task_id: string }).task_id;

      // Second call: dep ID would be unknown in a fresh session, but idempotency
      // short-circuits before depends_on validation — returns existing task_id
      const second = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "idempotent task",
        priority: "low",
        depends_on: ["nonexistent-dep"],
        idempotency_key: "idem-key-1",
      });
      expect(second.success).toBe(true);
      expect((second as { task_id: string }).task_id).toBe(originalId);
    });

    test("depends_on with unknown task ID returns error", () => {
      const result = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "task with bad dep",
        priority: "low",
        depends_on: ["nonexistent-dep-id"],
      });
      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain("depends_on contains unknown task IDs");
    });

    test("depends_on with cross-session task ID returns error", () => {
      const depResult = handleCreateTask("sess-other", {
        agent_id: "pm",
        title: "dep in other session",
        priority: "low",
      });
      expect(depResult.success).toBe(true);
      const depId = (depResult as { task_id: string }).task_id;

      const result = handleCreateTask("sess-1", {
        agent_id: "pm",
        title: "task depending on other session",
        priority: "low",
        depends_on: [depId],
      });
      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain("depends_on contains unknown task IDs");
    });

    test("root task (no parent) unaffected by circuit breakers", () => {
      // Create many root tasks — no limit applies
      for (let i = 0; i < 5; i++) {
        const r = handleCreateTask("sess-1", {
          agent_id: "pm",
          title: `root ${i}`,
          priority: "low",
        });
        expect(r.success).toBe(true);
      }
    });
  });
});
