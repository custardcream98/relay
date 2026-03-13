import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "../schema";
import { getReviewsByReviewer, insertReview, updateReviewStatus } from "./reviews";

describe("review queries", () => {
  let db: Database;
  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });
  afterEach(() => db.close());

  test("create review request", () => {
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

  test("update review status", () => {
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
