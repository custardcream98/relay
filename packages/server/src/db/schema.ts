import { _resetStore } from "../store";
import type { SqliteDatabase } from "./types";

// Run DB migrations — resets the in-memory store for a clean state
export function runMigrations(_db: SqliteDatabase): void {
  _resetStore();
}

// Drop all tables (for tests and development only) — resets the in-memory store
export function dropAllTables(_db: SqliteDatabase): void {
  _resetStore();
}
