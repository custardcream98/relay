import { beforeEach, describe, expect, test } from "bun:test";

import {
  _resetStore,
  getAllArtifacts,
  getAllMessages,
  getAllTasks,
  insertArtifact,
  insertMessage,
  insertTask,
} from "../store";

describe("in-memory store reset", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("_resetStore clears all collections", () => {
    insertTask({
      id: "t1",
      session_id: "sess-1",
      title: "Test",
      description: null,
      assignee: null,
      status: "todo",
      priority: "medium",
      created_by: "agent",
    });
    insertMessage({
      id: "m1",
      session_id: "sess-1",
      from_agent: "agent",
      to_agent: null,
      content: "hello",
      thread_id: null,
      metadata: null,
    });
    insertArtifact({
      id: "a1",
      session_id: "sess-1",
      name: "test-artifact",
      type: "text",
      content: "content",
      created_by: "agent",
      task_id: null,
    });
    expect(getAllTasks("sess-1")).toHaveLength(1);
    expect(getAllMessages("sess-1")).toHaveLength(1);
    expect(getAllArtifacts("sess-1")).toHaveLength(1);

    _resetStore();

    expect(getAllTasks("sess-1")).toHaveLength(0);
    expect(getAllMessages("sess-1")).toHaveLength(0);
    expect(getAllArtifacts("sess-1")).toHaveLength(0);
  });

  test("_resetStore is idempotent (calling twice does not throw)", () => {
    expect(() => _resetStore()).not.toThrow();
    expect(() => _resetStore()).not.toThrow();
  });
});
