// packages/server/src/tools/session-isolation.test.ts
// Tests for concurrent session isolation — verifies that data from one session
// is never visible to queries in a different session, across all tool handlers.
import { beforeEach, describe, expect, test } from "bun:test";

import { _resetStore } from "../store";
import { handleGetArtifact, handlePostArtifact } from "./artifacts";
import { handleGetMessages, handleSendMessage } from "./messaging";
import { handleRequestReview, handleSubmitReview } from "./review";
import { handleClaimTask, handleCreateTask, handleGetAllTasks, handleUpdateTask } from "./tasks";

describe("session isolation — cross-session data leakage", () => {
  beforeEach(() => {
    _resetStore();
  });

  // ─── Messages ───────────────────────────────────────────────────────────────

  describe("messaging", () => {
    test("messages from session-A are not visible in session-B", async () => {
      await handleSendMessage("session-A", {
        agent_id: "pm",
        to: "fe",
        content: "Session A only message",
      });

      const result = await handleGetMessages("session-B", { agent_id: "fe" });
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(0);
    });

    test("broadcast messages are session-scoped", async () => {
      await handleSendMessage("session-A", {
        agent_id: "pm",
        to: null,
        content: "Session A broadcast",
      });

      const resultA = await handleGetMessages("session-A", { agent_id: "fe" });
      const resultB = await handleGetMessages("session-B", { agent_id: "fe" });
      expect(resultA.messages).toHaveLength(1);
      expect(resultB.messages).toHaveLength(0);
    });

    test("concurrent sessions can have same agent names without cross-contamination", async () => {
      await handleSendMessage("session-A", {
        agent_id: "fe",
        to: "be",
        content: "From session A",
      });
      await handleSendMessage("session-B", {
        agent_id: "fe",
        to: "be",
        content: "From session B",
      });

      const resultA = await handleGetMessages("session-A", { agent_id: "be" });
      const resultB = await handleGetMessages("session-B", { agent_id: "be" });
      expect(resultA.messages).toHaveLength(1);
      expect(resultA.messages[0].content).toBe("From session A");
      expect(resultB.messages).toHaveLength(1);
      expect(resultB.messages[0].content).toBe("From session B");
    });
  });

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  describe("tasks", () => {
    test("get_all_tasks with assignee filter does not return tasks from other sessions", async () => {
      await handleCreateTask("session-A", {
        agent_id: "pm",
        title: "Session A task",
        assignee: "fe",
        priority: "high",
      });

      const result = await handleGetAllTasks("session-B", { agent_id: "fe", assignee: "fe" });
      expect(result.tasks).toHaveLength(0);
    });

    test("get_all_tasks does not include tasks from other sessions", async () => {
      await handleCreateTask("session-A", {
        agent_id: "pm",
        title: "Task in A",
        assignee: "fe",
        priority: "medium",
      });
      await handleCreateTask("session-B", {
        agent_id: "pm",
        title: "Task in B",
        assignee: "be",
        priority: "medium",
      });

      const resultA = await handleGetAllTasks("session-A", { agent_id: "qa" });
      const resultB = await handleGetAllTasks("session-B", { agent_id: "qa" });
      expect(resultA.tasks).toHaveLength(1);
      expect(resultA.tasks[0].title).toBe("Task in A");
      expect(resultB.tasks).toHaveLength(1);
      expect(resultB.tasks[0].title).toBe("Task in B");
    });

    test("get_all_tasks counts only tasks from the queried session", async () => {
      await handleCreateTask("session-A", {
        agent_id: "pm",
        title: "A task 1",
        assignee: "fe",
        priority: "high",
      });
      await handleCreateTask("session-A", {
        agent_id: "pm",
        title: "A task 2",
        assignee: "be",
        priority: "medium",
      });

      const resultB = await handleGetAllTasks("session-B", { agent_id: "pm" });
      expect(resultB.tasks).toHaveLength(0);

      const resultA = await handleGetAllTasks("session-A", { agent_id: "pm" });
      expect(resultA.tasks).toHaveLength(2);
    });

    test("update_task cannot modify a task that belongs to a different session", async () => {
      const { task_id } = await handleCreateTask("session-A", {
        agent_id: "pm",
        title: "Session A task",
        assignee: "fe",
        priority: "high",
      });

      // Attempt to update task from session-B — should not affect the task
      const result = await handleUpdateTask("session-B", {
        agent_id: "fe",
        task_id: task_id as string,
        status: "done",
      });
      expect(result.success).toBe(false);

      // Verify the task is unchanged in session-A
      const tasks = await handleGetAllTasks("session-A", { agent_id: "pm" });
      expect(tasks.tasks[0].status).toBe("todo");
    });
  });

  // ─── Artifacts ──────────────────────────────────────────────────────────────

  describe("artifacts", () => {
    test("artifact posted in session-A is not retrievable from session-B", async () => {
      await handlePostArtifact("session-A", {
        agent_id: "designer",
        name: "shared-name",
        type: "spec",
        content: "Session A content",
      });

      const result = await handleGetArtifact("session-B", {
        agent_id: "fe",
        name: "shared-name",
      });
      // handleGetArtifact returns success:false when artifact is not found in the session
      expect(result.artifact).toBeNull();
    });

    test("two sessions can store artifacts with the same name independently", async () => {
      await handlePostArtifact("session-A", {
        agent_id: "be",
        name: "api-spec",
        type: "openapi",
        content: "Session A spec",
      });
      await handlePostArtifact("session-B", {
        agent_id: "be",
        name: "api-spec",
        type: "openapi",
        content: "Session B spec",
      });

      const artA = await handleGetArtifact("session-A", {
        agent_id: "fe",
        name: "api-spec",
      });
      const artB = await handleGetArtifact("session-B", {
        agent_id: "fe",
        name: "api-spec",
      });
      expect(artA.artifact?.content).toBe("Session A spec");
      expect(artB.artifact?.content).toBe("Session B spec");
    });
  });

  // ─── Reviews ────────────────────────────────────────────────────────────────

  describe("reviews", () => {
    test("review submitted in session-A cannot be fetched from session-B", async () => {
      const { review_id } = await handleRequestReview("session-A", {
        agent_id: "fe",
        artifact_id: "art-1",
        reviewer: "qa",
      });
      await handleSubmitReview("session-A", {
        agent_id: "qa",
        review_id: review_id as string,
        status: "approved",
        comments: "All good.",
      });

      // Submitting the same review_id from session-B should fail (not found)
      const result = await handleSubmitReview("session-B", {
        agent_id: "qa",
        review_id: review_id as string,
        status: "approved",
        comments: "Should not work.",
      });
      // The review belongs to session-A; session-B cannot update it
      expect(result.success).toBe(false);
    });
  });

  // ─── Concurrent claim_task (race condition safety) ──────────────────────────

  describe("claim_task race condition", () => {
    test("only one agent succeeds when two agents claim the same task simultaneously", async () => {
      const { task_id } = await handleCreateTask("session-A", {
        agent_id: "pm",
        title: "Race condition task",
        priority: "high",
        // Unassigned so any agent can claim
      });

      // Simulate two agents racing to claim the same task
      const [claimFe, claimBe] = await Promise.all([
        handleClaimTask("session-A", { agent_id: "fe", task_id: task_id as string }),
        handleClaimTask("session-A", { agent_id: "be", task_id: task_id as string }),
      ]);

      const successCount = [claimFe.claimed, claimBe.claimed].filter(Boolean).length;
      expect(successCount).toBe(1);
    });

    test("claiming a task in session-A does not affect the same-named task in session-B", async () => {
      // Create tasks with same assignee in two sessions
      const { task_id: taskIdA } = await handleCreateTask("session-A", {
        agent_id: "pm",
        title: "Parallel task",
        assignee: "fe",
        priority: "high",
      });
      const { task_id: taskIdB } = await handleCreateTask("session-B", {
        agent_id: "pm",
        title: "Parallel task",
        assignee: "fe",
        priority: "high",
      });

      await handleClaimTask("session-A", { agent_id: "fe", task_id: taskIdA as string });

      // session-B task should still be claimable
      const claimB = await handleClaimTask("session-B", {
        agent_id: "fe",
        task_id: taskIdB as string,
      });
      expect(claimB.claimed).toBe(true);

      // session-A task should no longer be claimable (already in_progress)
      const reclaimA = await handleClaimTask("session-A", {
        agent_id: "fe",
        task_id: taskIdA as string,
      });
      expect(reclaimA.claimed).toBe(false);
    });
  });
});
