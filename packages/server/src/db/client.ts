// packages/server/src/db/client.ts
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getDbPath } from "../config";
import { runMigrations } from "./schema";
import type { SqliteDatabase } from "./types";

// Singleton DB instance
let _db: SqliteDatabase | null = null;

// Returns the DB instance.
// Initializes and migrates the DB on first call.
// DB path is resolved via getDbPath() — supports RELAY_DB_PATH, RELAY_INSTANCE, and default.
export function getDb(): SqliteDatabase {
  if (!_db) {
    const path = getDbPath();
    // Create the directory if it does not exist yet
    const dir = dirname(path);
    if (dir !== "." && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    const db = new Database(path);
    // Enable WAL mode for better concurrent read performance
    db.exec("PRAGMA journal_mode = WAL");
    _db = db as unknown as SqliteDatabase;
    runMigrations(_db);
    // Enforce FK constraints at runtime (SQLite disables them by default)
    _db.exec("PRAGMA foreign_keys = ON");
  }
  return _db;
}

// Close the DB connection and reset the singleton instance
export function closeDb(): void {
  _db?.close();
  _db = null;
}

// For tests only: inject an already-created DB instance (e.g. bun:sqlite in-memory DB)
export function _setDb(db: SqliteDatabase): void {
  _db = db;
}
