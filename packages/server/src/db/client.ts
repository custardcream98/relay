// packages/server/src/db/client.ts
import { _resetStore } from "../store";
import type { SqliteDatabase } from "./types";

// Dummy statement — all ops are no-ops since the in-memory store handles persistence
const noopStatement = {
  run: () => ({ changes: 0 }),
  get: () => undefined,
  all: () => [],
};

// Dummy DB — satisfies SqliteDatabase interface but does nothing
const dummyDb: SqliteDatabase = {
  prepare: () => noopStatement,
  exec: () => undefined,
  close: () => undefined,
};

export function getDb(): SqliteDatabase {
  return dummyDb;
}

// No-op — in-memory store has no connection to close
export function closeDb(): void {}

// For tests: calling _setDb now just resets the store (same effect as before — test isolation)
export function _setDb(_db: SqliteDatabase): void {
  _resetStore();
}
