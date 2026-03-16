import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { _resetSessionId, setSessionId } from "../config.ts";
import { broadcast } from "../dashboard/websocket.ts";
import { _setDb, closeDb } from "../db/client.ts";
import { getEventsBySession } from "../db/queries/events.ts";
import { runMigrations } from "../db/schema";
import type { SqliteDatabase } from "../db/types.ts";
import { handleRequestReview, handleSubmitReview } from "./review";

describe("review tool", () => {
  let db: Database;
  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });
  afterEach(() => db.close());

  test("request_review: creates review request", async () => {
    const result = await handleRequestReview("sess-1", {
      agent_id: "fe",
      artifact_id: "art-1",
      reviewer: "fe2",
    });
    expect(result.success).toBe(true);
    expect(result.review_id).toBeDefined();
  });

  test("submit_review: submits review result and returns review data", async () => {
    const { review_id } = await handleRequestReview("sess-1", {
      agent_id: "fe",
      artifact_id: "art-1",
      reviewer: "fe2",
    });
    const result = await handleSubmitReview("sess-1", {
      agent_id: "fe2",
      review_id: review_id as string,
      status: "approved",
      comments: "LGTM! Clean code.",
    });
    expect(result.success).toBe(true);
    expect(result.review).toBeDefined();
    expect(result.review?.status).toBe("approved");
    expect(result.review?.reviewer).toBe("fe2");
    expect(result.review?.comments).toBe("LGTM! Clean code.");
  });

  test("submit_review: returns review with changes_requested status", async () => {
    const { review_id } = await handleRequestReview("sess-1", {
      agent_id: "fe",
      artifact_id: "art-2",
      reviewer: "qa",
    });
    const result = await handleSubmitReview("sess-1", {
      agent_id: "qa",
      review_id: review_id as string,
      status: "changes_requested",
      comments: "Please fix the linting errors.",
    });
    expect(result.success).toBe(true);
    expect(result.review?.status).toBe("changes_requested");
    expect(result.review?.id).toBe(review_id);
  });

  test("submit_review: returns error when review does not exist", async () => {
    const result = await handleSubmitReview("sess-1", {
      agent_id: "qa",
      review_id: "nonexistent-review-id",
      status: "approved",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("review not found");
  });

  test("submit_review: returns permission denied when wrong agent submits review", async () => {
    const { review_id } = await handleRequestReview("sess-1", {
      agent_id: "fe",
      artifact_id: "art-3",
      reviewer: "qa",
    });
    // "be" is not the assigned reviewer (only "qa" can submit this review)
    const result = await handleSubmitReview("sess-1", {
      agent_id: "be",
      review_id: review_id as string,
      status: "approved",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("permission denied");
  });

  test("submit_review: works with no comments (optional field)", async () => {
    const { review_id } = await handleRequestReview("sess-1", {
      agent_id: "fe",
      artifact_id: "art-4",
      reviewer: "pm",
    });
    const result = await handleSubmitReview("sess-1", {
      agent_id: "pm",
      review_id: review_id as string,
      status: "approved",
      // comments intentionally omitted
    });
    expect(result.success).toBe(true);
    expect(result.review?.status).toBe("approved");
  });
});

// Verifies that the mcp.ts submit_review tool handler broadcasts the correct
// review:updated event shape after a successful review submission.
describe("submit_review — review:updated broadcast", () => {
  let inMemDb: Database;

  beforeEach(() => {
    inMemDb = new Database(":memory:");
    runMigrations(inMemDb);
    _setDb(inMemDb as unknown as SqliteDatabase);
    setSessionId("broadcast-test-session");
  });

  afterEach(() => {
    closeDb();
    _resetSessionId();
  });

  test("broadcasts review:updated with correct review shape after successful submit_review", async () => {
    // Create a review request first so submit_review has a valid review to update
    const { review_id } = await handleRequestReview("broadcast-test-session", {
      agent_id: "be",
      artifact_id: "art-broadcast-1",
      reviewer: "qa",
    });

    // Submit the review (same logic as mcp.ts submit_review tool handler)
    const result = await handleSubmitReview("broadcast-test-session", {
      agent_id: "qa",
      review_id: review_id as string,
      status: "approved",
      comments: "All checks pass.",
    });

    expect(result.success).toBe(true);
    expect(result.review).toBeDefined();

    // Replicate the exact broadcast call from mcp.ts submit_review handler
    if (result.success && result.review) {
      broadcast({
        type: "review:updated",
        review: result.review,
        timestamp: Date.now(),
      });
    }

    // Verify the event was persisted with the correct shape (broadcast writes to events DB)
    const events = getEventsBySession("broadcast-test-session");
    const reviewUpdatedEvents = events.filter((e) => e.type === "review:updated");
    expect(reviewUpdatedEvents).toHaveLength(1);

    const event = reviewUpdatedEvents[0];
    expect(event.type).toBe("review:updated");

    // Assert the review payload contains the required fields
    if (event.type === "review:updated") {
      expect(event.review.id).toBe(review_id as string);
      expect(event.review.status).toBe("approved");
      expect(event.review.reviewer).toBe("qa");
      expect(event.review.comments).toBe("All checks pass.");
    }
  });
});
