import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../schema";
import { insertReview, updateReviewStatus, getReviewsByReviewer } from "./reviews";

describe("리뷰 쿼리", () => {
  let db: Database;
  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });
  afterEach(() => db.close());

  test("리뷰 요청 생성", () => {
    insertReview(db, {
      id: "rev-1",
      session_id: "sess-1",
      artifact_id: "art-1",
      reviewer: "be",
      requester: "fe",
      status: "pending",
      comments: null,
    });
    const reviews = getReviewsByReviewer(db, "sess-1", "be");
    expect(reviews).toHaveLength(1);
  });

  test("리뷰 상태 업데이트", () => {
    insertReview(db, {
      id: "rev-2",
      session_id: "sess-1",
      artifact_id: "art-1",
      reviewer: "be2",
      requester: "fe",
      status: "pending",
      comments: null,
    });
    updateReviewStatus(db, "rev-2", "approved", "LGTM!");
    const reviews = getReviewsByReviewer(db, "sess-1", "be2");
    expect(reviews[0].status).toBe("approved");
    expect(reviews[0].comments).toBe("LGTM!");
  });
});
