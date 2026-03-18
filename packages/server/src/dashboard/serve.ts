// packages/server/src/dashboard/serve.ts
// Dashboard HTTP server bootstrap with EADDRINUSE retry.

import { serve } from "@hono/node-server";
import { findAvailablePort, PORT_AUTO_END, PORT_AUTO_START } from "../port.js";
import { app } from "./hono.js";

export type DashboardResult = { server: ReturnType<typeof serve>; port: number } | null;

/**
 * Start the dashboard HTTP server on the given port.
 * Awaits the "listening" event before resolving, so the port is guaranteed bound on success.
 * On EADDRINUSE, retries with the next available port in the auto-select range.
 * Returns null when no port can be bound — MCP stdio server still runs (graceful degradation).
 */
export async function tryServe(port: number): Promise<DashboardResult> {
  return new Promise((resolve) => {
    const srv = serve({ fetch: app.fetch, port });
    srv.once("error", async (err: NodeJS.ErrnoException) => {
      srv.close(); // Release the failed server instance before retry or bail
      if (err.code === "EADDRINUSE") {
        // Port was occupied — try next available port in the auto-select range
        const next = await findAvailablePort(port + 1, PORT_AUTO_END);
        if (next !== null) {
          resolve(await tryServe(next));
        } else {
          console.error(
            `[relay] no available port in ${PORT_AUTO_START}-${PORT_AUTO_END} — dashboard unavailable, MCP server will still start.`
          );
          resolve(null);
        }
      } else {
        console.error("[relay] dashboard server error:", err);
        resolve(null);
      }
    });
    srv.once("listening", () => {
      console.error(`[relay] dashboard: http://localhost:${port}`);
      resolve({ server: srv, port });
    });
  });
}
