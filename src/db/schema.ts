import type { Database } from "bun:sqlite";

// DB 스키마 마이그레이션을 실행한다
export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      from_agent TEXT NOT NULL,
      to_agent TEXT,
      content TEXT NOT NULL,
      thread_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      assignee TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT NOT NULL,
      task_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      requester TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      comments TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      agent_id TEXT,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

// 모든 테이블을 삭제한다 (테스트/개발 용도)
export function dropAllTables(db: Database): void {
  db.exec(`
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS artifacts;
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS events;
  `);
}
