// packages/server/src/dashboard/utils.ts
// Shared utilities for dashboard HTTP and WebSocket handlers.

/**
 * Returns true if the given origin is a localhost origin (any port).
 * Used to restrict dashboard access to localhost clients only, preventing
 * cross-origin requests from arbitrary web pages.
 *
 * Returns false for undefined (no Origin header) — callers decide whether
 * to allow or deny requests with no origin (same-origin requests, curl, etc.)
 */
export function isLocalhostOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    // Malformed origin — not localhost
    return false;
  }
}
