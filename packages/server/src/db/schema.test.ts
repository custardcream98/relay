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
});
