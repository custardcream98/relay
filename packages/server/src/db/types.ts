// packages/server/src/db/types.ts
// Common DB interface satisfied by both better-sqlite3 (production) and bun:sqlite (tests)

export interface SqliteStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid?: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): unknown;
  close(): void;
}
