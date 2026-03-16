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
import { runMigrations } from "./schema";
import type { SqliteDatabase } from "./types";

// Dummy db — runMigrations no longer touches SQLite; it just resets the in-memory store
const dummyDb = {} as unknown as SqliteDatabase;

describe("DB schema migrations", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("runMigrations resets the in-memory store", () => {
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

    runMigrations(dummyDb);

    expect(getAllTasks("sess-1")).toHaveLength(0);
    expect(getAllMessages("sess-1")).toHaveLength(0);
    expect(getAllArtifacts("sess-1")).toHaveLength(0);
  });

  test("runMigrations is idempotent (calling twice does not throw)", () => {
    expect(() => runMigrations(dummyDb)).not.toThrow();
    expect(() => runMigrations(dummyDb)).not.toThrow();
  });
});
