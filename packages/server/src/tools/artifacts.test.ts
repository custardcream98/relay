import { beforeEach, describe, expect, test } from "bun:test";

import { _resetStore } from "../store";
import { handleGetArtifact, handlePostArtifact } from "./artifacts";

describe("artifacts tool", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("post_artifact: saves artifact", async () => {
    const result = await handlePostArtifact("sess-1", {
      agent_id: "designer",
      name: "login-design",
      type: "figma_spec",
      content: JSON.stringify({ screens: ["login"] }),
      task_id: "task-1",
    });
    expect(result.success).toBe(true);
    expect(result.artifact_id).toBeDefined();
  });

  test("get_artifact: retrieves by name", async () => {
    await handlePostArtifact("sess-1", {
      agent_id: "designer",
      name: "login-design",
      type: "figma_spec",
      content: "{}",
    });
    const result = await handleGetArtifact("sess-1", {
      agent_id: "fe",
      name: "login-design",
    });
    expect(result.success).toBe(true);
    expect(result.artifact?.type).toBe("figma_spec");
  });

  test("get_artifact: returns null artifact when name does not exist", async () => {
    const result = await handleGetArtifact("sess-1", {
      agent_id: "fe",
      name: "nonexistent-artifact",
    });
    // handleGetArtifact returns success:false + artifact:null when not found
    expect(result.artifact).toBeNull();
    expect((result as { success: boolean; error?: string }).error).toContain("artifact not found");
  });

  test("post_artifact: works without optional task_id", async () => {
    const result = await handlePostArtifact("sess-1", {
      agent_id: "be",
      name: "api-spec",
      type: "document",
      content: "# API Spec",
      // task_id intentionally omitted
    });
    expect(result.success).toBe(true);
    expect(result.artifact_id).toBeDefined();
  });

  test("get_artifact: returns artifact content verbatim", async () => {
    const content = JSON.stringify({ key: "value", nested: { arr: [1, 2, 3] } });
    await handlePostArtifact("sess-1", {
      agent_id: "be",
      name: "data-spec",
      type: "report",
      content,
    });
    const result = await handleGetArtifact("sess-1", {
      agent_id: "fe",
      name: "data-spec",
    });
    expect(result.artifact?.content).toBe(content);
  });

  // Session isolation: an artifact posted in sess-1 must not be visible from sess-2.
  // getArtifactByName filters by session_id, so cross-session access returns null.
  test("get_artifact: cannot retrieve artifact from a different session", async () => {
    await handlePostArtifact("sess-1", {
      agent_id: "be",
      name: "shared-name",
      type: "document",
      content: "secret content",
    });
    const result = await handleGetArtifact("sess-2", {
      agent_id: "fe",
      name: "shared-name",
    });
    expect(result.success).toBe(false);
    expect(result.artifact).toBeNull();
  });

  // When two artifacts share the same name in the same session, get_artifact returns
  // the most recently posted one (highest created_at, or latest insertion index on tie).
  test("get_artifact: returns the most recently posted artifact when names collide", async () => {
    await handlePostArtifact("sess-1", {
      agent_id: "be",
      name: "versioned",
      type: "document",
      content: "v1",
    });
    await handlePostArtifact("sess-1", {
      agent_id: "be",
      name: "versioned",
      type: "document",
      content: "v2",
    });
    const result = await handleGetArtifact("sess-1", { agent_id: "fe", name: "versioned" });
    expect(result.success).toBe(true);
    expect(result.artifact?.content).toBe("v2");
  });
});
