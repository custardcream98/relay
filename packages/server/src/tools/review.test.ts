import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "../db/schema";
import { handleRequestReview, handleSubmitReview } from "./review";

describe("review 툴", () => {
  let db: Database;
  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });
  afterEach(() => db.close());

  test("request_review: 리뷰 요청 생성", async () => {
    const result = await handleRequestReview(db, "sess-1", {
      agent_id: "fe",
      artifact_id: "art-1",
      reviewer: "fe2",
    });
    expect(result.success).toBe(true);
    expect(result.review_id).toBeDefined();
  });

  test("submit_review: 리뷰 결과 제출", async () => {
    const { review_id } = await handleRequestReview(db, "sess-1", {
      agent_id: "fe",
      artifact_id: "art-1",
      reviewer: "fe2",
    });
    const result = await handleSubmitReview(db, "sess-1", {
      agent_id: "fe2",
      review_id: review_id as string,
      status: "approved",
      comments: "LGTM! 코드가 깔끔합니다.",
    });
    expect(result.success).toBe(true);
  });
});
