import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "../db/schema";
import { handleGetArtifact, handlePostArtifact } from "./artifacts";

describe("artifacts tool", () => {
  let db: Database;
  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });
  afterEach(() => db.close());

  test("post_artifact: saves artifact", async () => {
    const result = await handlePostArtifact(db, "sess-1", {
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
    await handlePostArtifact(db, "sess-1", {
      agent_id: "designer",
      name: "login-design",
      type: "figma_spec",
      content: "{}",
    });
    const result = await handleGetArtifact(db, "sess-1", {
      agent_id: "fe",
      name: "login-design",
    });
    expect(result.success).toBe(true);
    expect(result.artifact?.type).toBe("figma_spec");
  });
});
