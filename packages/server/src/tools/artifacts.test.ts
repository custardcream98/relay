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
});
