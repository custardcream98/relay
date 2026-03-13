import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getRelayDir } from "../config";
import { runMigrations } from "./schema";

// Singleton DB instance
let _db: Database | null = null;

// Returns the DB instance.
// Initializes and migrates the DB on first call.
export function getDb(): Database {
  if (!_db) {
    const path = process.env.DB_PATH ?? `${getRelayDir()}/relay.db`;
    // Create the directory if it does not exist yet
    const dir = dirname(path);
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
