import { beforeEach, describe, expect, test } from "bun:test";
import { _resetStore, getReviewById, insertReview, updateReviewStatus } from "../../store";

describe("review queries", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("create review request", () => {
    insertReview({
      id: "rev-1",
      session_id: "sess-1",
      artifact_id: "art-1",
      reviewer: "be",
      requester: "fe",
      status: "pending",
      comments: null,
    });
    const review = getReviewById("rev-1", "sess-1");
    expect(review).not.toBeNull();
    expect(review?.reviewer).toBe("be");
  });

  test("update review status", () => {
    insertReview({
      id: "rev-2",
      session_id: "sess-1",
      artifact_id: "art-1",
      reviewer: "be2",
      requester: "fe",
      status: "pending",
      comments: null,
    });
    updateReviewStatus("rev-2", "sess-1", "approved", "LGTM!");
    const review = getReviewById("rev-2", "sess-1");
    expect(review).not.toBeNull();
    expect(review?.status).toBe("approved");
    expect(review?.comments).toBe("LGTM!");
  });
});
