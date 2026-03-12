import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/schema";
import { handlePostArtifact, handleGetArtifact } from "./artifacts";

describe("artifacts 툴", () => {
  let db: Database;
  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });
  afterEach(() => db.close());

  test("post_artifact: 아티팩트 저장", async () => {
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

  test("get_artifact: 이름으로 조회", async () => {
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
