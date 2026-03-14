import { afterEach, describe, expect, test } from "bun:test";
import { _resetSessionId, getSessionId, setSessionId } from "./config";

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
