import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "./schema";

describe("DB 스키마 마이그레이션", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("messages 테이블 생성", () => {
    const row = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'")
      .get();
    expect(row).toBeTruthy();
  });

  test("tasks 테이블 생성", () => {
    const row = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
      .get();
    expect(row).toBeTruthy();
  });

  test("artifacts 테이블 생성", () => {
    const row = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='artifacts'")
      .get();
    expect(row).toBeTruthy();
  });

  test("reviews 테이블 생성", () => {
    const row = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='reviews'")
      .get();
    expect(row).toBeTruthy();
  });

  test("events 테이블 생성", () => {
    const row = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
      .get();
    expect(row).toBeTruthy();
  });
});
