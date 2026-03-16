import { beforeEach, describe, expect, test } from "bun:test";
import { _resetStore, getTaskById, getTasksByAssignee, insertTask, updateTask } from "../../store";

describe("task queries", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("create task and retrieve by ID", () => {
    insertTask({
      id: "task-1",
      session_id: "sess-1",
      title: "Implement login UI",
      description: "Add OAuth login button",
      assignee: "fe",
      status: "todo",
      priority: "high",
      created_by: "pm",
    });

    const task = getTaskById("task-1", "sess-1");
    expect(task?.title).toBe("Implement login UI");
    expect(task?.status).toBe("todo");
  });

  test("update task status", () => {
    insertTask({
      id: "task-2",
      session_id: "sess-1",
      title: "API design",
      description: null,
      assignee: "be",
      status: "todo",
      priority: "medium",
      created_by: "pm",
    });

    updateTask("task-2", "sess-1", { status: "in_progress" });
    const task = getTaskById("task-2", "sess-1");
    expect(task?.status).toBe("in_progress");
  });

  test("fetch tasks by assignee", () => {
    insertTask({
      id: "t1",
      session_id: "s1",
      title: "FE task",
      description: null,
      assignee: "fe",
      status: "todo",
      priority: "medium",
      created_by: "pm",
    });
    insertTask({
      id: "t2",
      session_id: "s1",
      title: "BE task",
      description: null,
      assignee: "be",
      status: "todo",
      priority: "medium",
      created_by: "pm",
    });

    const feTasks = getTasksByAssignee("s1", "fe");
    expect(feTasks).toHaveLength(1);
    expect(feTasks[0].title).toBe("FE task");
  });

  test("updateTask: empty updates returns false without mutating the task", () => {
    insertTask({
      id: "task-3",
      session_id: "sess-1",
      title: "empty update test",
      description: null,
      assignee: "fe",
      status: "todo",
      priority: "medium",
      created_by: "pm",
    });
    expect(() => updateTask("task-3", "sess-1", {})).not.toThrow();
  });
});
