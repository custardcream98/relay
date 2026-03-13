import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runMigrations } from "./schema";

// Singleton DB instance
let _db: Database | null = null;

// RELAY_DIR 기준으로 DB 파일 경로를 결정 (기본: .relay/relay.db)
// RELAY_PROJECT_ROOT를 먼저 확인 (bunx 실행 시 CWD가 /tmp가 되는 경우 대비)
const PROJECT_ROOT = process.env.RELAY_PROJECT_ROOT ?? process.cwd();
const RELAY_DIR = process.env.RELAY_DIR ?? join(PROJECT_ROOT, ".relay");

// Returns the DB instance.
// Initializes and migrates the DB on first call.
export function getDb(): Database {
  if (!_db) {
    const path = process.env.DB_PATH ?? join(RELAY_DIR, "relay.db");
    // DB 파일이 위치할 디렉토리가 없으면 생성
    const dir = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : ".";
    if (dir !== "." && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    _db = new Database(path);
    // Enable WAL mode for improved concurrency
    _db.exec("PRAGMA journal_mode = WAL;");
    runMigrations(_db);
  }
  return _db;
}

// For tests: initialize the DB at the given path (e.g. ":memory:")
export function initDb(path: string): void {
  _db?.close();
  _db = new Database(path);
  runMigrations(_db);
}

// Close the DB connection and reset the singleton instance
export function closeDb(): void {
  _db?.close();
  _db = null;
}
