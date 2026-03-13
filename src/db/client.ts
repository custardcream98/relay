import { Database } from "bun:sqlite";
import { runMigrations } from "./schema";

// 단일 DB 인스턴스 (싱글톤 패턴)
let _db: Database | null = null;

// DB 인스턴스를 반환한다
// 첫 호출 시 DB를 초기화하고 마이그레이션을 실행한다
export function getDb(): Database {
  if (!_db) {
    const path = process.env.DB_PATH ?? "relay.db";
    _db = new Database(path);
    // WAL 모드로 설정하여 동시성 향상
    _db.exec("PRAGMA journal_mode = WAL;");
    runMigrations(_db);
  }
  return _db;
}

// 테스트용: 주어진 경로(":memory:" 등)로 DB를 초기화한다
export function initDb(path: string): void {
  _db?.close();
  _db = new Database(path);
  runMigrations(_db);
}

// DB 연결을 닫고 싱글톤 인스턴스를 초기화한다
export function closeDb(): void {
  _db?.close();
  _db = null;
}
