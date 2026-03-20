import { afterEach, describe, expect, test } from "bun:test";

import {
  _resetProjectRoot,
  _resetSessionId,
  getInstanceId,
  getRelayDir,
  getSessionId,
  setSessionId,
  uriToPath,
} from "./config";

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

  test("resolves relative RELAY_DIR to an absolute path", () => {
    process.env.RELAY_DIR = ".relay";
    const dir = getRelayDir();
    // resolve() must produce an absolute path, not the raw relative string
    expect(dir.startsWith("/")).toBe(true);
    expect(dir.endsWith("/.relay") || dir.endsWith("\\.relay")).toBe(true);
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
    // Auto-generated format: YYYY-MM-DD-HHmmss-XXXX (4-char hex suffix for collision avoidance)
    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}-[0-9a-f]{4}$/);
  });
});
