import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "./schema";

describe("DB schema migrations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("creates messages table", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'")
      .get();
    expect(row).toBeTruthy();
  });

  test("creates tasks table", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
      .get();
    expect(row).toBeTruthy();
  });

  test("creates artifacts table", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='artifacts'")
      .get();
    expect(row).toBeTruthy();
  });

  test("creates reviews table", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reviews'")
      .get();
    expect(row).toBeTruthy();
  });

  test("creates events table", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
      .get();
    expect(row).toBeTruthy();
  });

  test("runMigrations is idempotent (calling twice does not throw)", () => {
    // CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS must be safe to call repeatedly
    expect(() => runMigrations(db)).not.toThrow();
  });

  test("creates index on messages(session_id, to_agent)", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_messages_session'")
      .get();
    expect(row).toBeTruthy();
  });

  test("creates index on tasks(session_id, assignee)", () => {
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_tasks_session_assignee'"
      )
      .get();
    expect(row).toBeTruthy();
  });

  test("creates index on events(session_id, created_at)", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_events_session'")
      .get();
    expect(row).toBeTruthy();
  });
});
