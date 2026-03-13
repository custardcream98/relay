import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "../schema";
import { getArtifactByName, insertArtifact } from "./artifacts";

describe("아티팩트 쿼리", () => {
  let db: Database;
  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });
  afterEach(() => db.close());

  test("아티팩트 저장 및 이름으로 조회", () => {
    insertArtifact(db, {
      id: "art-1",
      session_id: "sess-1",
      name: "login-design",
      type: "figma_spec",
      content: JSON.stringify({ screens: ["login", "signup"] }),
      created_by: "designer",
      task_id: "task-1",
    });
    const art = getArtifactByName(db, "sess-1", "login-design");
    expect(art?.type).toBe("figma_spec");
  });
});
