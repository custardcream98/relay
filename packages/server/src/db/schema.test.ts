import { beforeEach, describe, expect, test } from "bun:test";
import { _resetStore, getAllTasks, insertTask } from "../store";
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
    expect(getAllTasks("sess-1")).toHaveLength(1);

    runMigrations(dummyDb);

    expect(getAllTasks("sess-1")).toHaveLength(0);
  });

  test("runMigrations is idempotent (calling twice does not throw)", () => {
    expect(() => runMigrations(dummyDb)).not.toThrow();
    expect(() => runMigrations(dummyDb)).not.toThrow();
  });
});
