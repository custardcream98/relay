import { beforeEach, describe, expect, test } from "bun:test";
import { _resetStore, getReviewsByReviewer, insertReview, updateReviewStatus } from "../../store";

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
    const reviews = getReviewsByReviewer("sess-1", "be");
    expect(reviews).toHaveLength(1);
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
    const reviews = getReviewsByReviewer("sess-1", "be2");
    expect(reviews).toHaveLength(1); // guard against accidental duplicate rows
    expect(reviews[0].status).toBe("approved");
    expect(reviews[0].comments).toBe("LGTM!");
  });
});
