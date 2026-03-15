import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  _resetProjectRoot,
  _resetSessionId,
  getDbPath,
  getInstanceId,
  getRelayDir,
  getSessionId,
  setSessionId,
  uriToPath,
} from "./config";

describe("getDbPath", () => {
  beforeEach(() => {
    delete process.env.RELAY_DB_PATH;
    delete process.env.RELAY_INSTANCE;
    delete process.env.RELAY_DIR;
    delete process.env.RELAY_PROJECT_ROOT;
  });

  afterEach(() => {
    delete process.env.RELAY_DB_PATH;
    delete process.env.RELAY_INSTANCE;
    delete process.env.RELAY_DIR;
    delete process.env.RELAY_PROJECT_ROOT;
  });

  test("returns RELAY_DB_PATH when set", () => {
    process.env.RELAY_DB_PATH = "/custom/path/relay.db";
    expect(getDbPath()).toBe("/custom/path/relay.db");
  });

  test("returns instance-scoped DB path when RELAY_INSTANCE is set", () => {
    process.env.RELAY_INSTANCE = "project-a";
    process.env.RELAY_DIR = "/tmp/relay-config-test";
    const path = getDbPath();
    expect(path).toContain("relay-project-a.db");
  });

  test("returns default relay.db when no env vars are set", () => {
    // RELAY_DIR must be set to get a deterministic path; otherwise it uses cwd()
    process.env.RELAY_DIR = "/tmp/relay-default-db-test";
    const path = getDbPath();
    // Should end with the plain relay.db filename (not an instance-scoped one)
    expect(path).toMatch(/relay\.db$/);
    expect(path).not.toMatch(/relay-\w+\.db$/);
  });
});

describe("getRelayDir", () => {
  afterEach(() => {
    delete process.env.RELAY_DIR;
    delete process.env.RELAY_PROJECT_ROOT;
    _resetProjectRoot();
  });

  test("returns RELAY_DIR when set", () => {
    process.env.RELAY_DIR = "/custom/.relay";
    expect(getRelayDir()).toBe("/custom/.relay");
  });

  test("falls back to {projectRoot}/.relay when RELAY_DIR is not set", () => {
    delete process.env.RELAY_DIR;
    process.env.RELAY_PROJECT_ROOT = "/some/project";
    const dir = getRelayDir();
    expect(dir).toBe("/some/project/.relay");
  });
});

describe("getInstanceId", () => {
  afterEach(() => {
    delete process.env.RELAY_INSTANCE;
  });

  test("returns undefined when RELAY_INSTANCE is not set", () => {
    delete process.env.RELAY_INSTANCE;
    expect(getInstanceId()).toBeUndefined();
  });

  test("returns the instance name when RELAY_INSTANCE is set", () => {
    process.env.RELAY_INSTANCE = "project-b";
    expect(getInstanceId()).toBe("project-b");
  });
});

describe("uriToPath", () => {
  test("converts a file:// URI to an absolute path", () => {
    const result = uriToPath("file:///Users/alice/project");
    expect(result).toBe("/Users/alice/project");
  });

  test("returns non-URI strings unchanged", () => {
    expect(uriToPath("/already/absolute")).toBe("/already/absolute");
    expect(uriToPath("relative/path")).toBe("relative/path");
  });
});

describe("setSessionId", () => {
  afterEach(() => {
    // Reset singleton between tests so they don't bleed into each other
    _resetSessionId();
  });

  test("overrides the session ID returned by getSessionId", () => {
    setSessionId("2026-03-14-007-ab12");
    expect(getSessionId()).toBe("2026-03-14-007-ab12");
  });

  test("second call overwrites the first", () => {
    setSessionId("first-session");
    setSessionId("second-session");
    expect(getSessionId()).toBe("second-session");
  });

  test("after reset, getSessionId auto-generates a timestamp-based ID", () => {
    setSessionId("override");
    _resetSessionId();
    const id = getSessionId();
    // Auto-generated format: YYYY-MM-DD-HHmmss
    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}$/);
  });
});
