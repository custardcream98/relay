// packages/server/src/port.ts
// Dashboard port resolution with auto-selection.

import { createServer } from "node:net";
import type { CliArgs } from "./cli.js";

export const PORT_AUTO_START = 3456;
export const PORT_AUTO_END = 3465;

/** Returns true if the given TCP port is available (not in use). */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    // No hostname — binds on all interfaces (same as @hono/node-server's serve()),
    // so the check accurately reflects whether serve() will succeed.
    server.listen(port);
  });
}

/** Finds an available port in the range [start, end]. Returns null if all are occupied. */
export async function findAvailablePort(start: number, end: number): Promise<number | null> {
  for (let port = start; port <= end; port++) {
    if (await isPortAvailable(port)) return port;
  }
  return null;
}

/**
 * Resolve the dashboard port.
 * Priority: CLI --port arg > DASHBOARD_PORT env var > auto-select from pool.
 */
export async function resolvePort(cliArgs: CliArgs): Promise<number> {
  // CLI arg takes highest priority
  if (cliArgs.port) return cliArgs.port;
  // Explicit env var — validate and use it (caller owns the choice)
  if (process.env.DASHBOARD_PORT) {
    const p = Number(process.env.DASHBOARD_PORT);
    if (!Number.isNaN(p) && p > 0 && p <= 65535) return p;
    console.error(
      `[relay] invalid DASHBOARD_PORT "${process.env.DASHBOARD_PORT}" — falling back to auto-select`
    );
  }
  // Auto-select from pool
  const found = await findAvailablePort(PORT_AUTO_START, PORT_AUTO_END);
  if (found === null) {
    console.error(
      `[relay] no available port found in range ${PORT_AUTO_START}-${PORT_AUTO_END} — falling back to ${PORT_AUTO_START}`
    );
    return PORT_AUTO_START;
  }
  return found;
}
