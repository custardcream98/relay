import { beforeEach, describe, expect, test } from "bun:test";
import { _resetStore, getArtifactByName, insertArtifact } from "../../store";

describe("artifact queries", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("store artifact and retrieve by name", () => {
    insertArtifact({
      id: "art-1",
      session_id: "sess-1",
      name: "login-design",
      type: "figma_spec",
      content: JSON.stringify({ screens: ["login", "signup"] }),
      created_by: "designer",
      task_id: "task-1",
    });
    const art = getArtifactByName("sess-1", "login-design");
    expect(art?.type).toBe("figma_spec");
  });
});
