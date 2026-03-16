// packages/server/src/schemas.ts
import { z } from "zod";

// Shared Zod schema for agent_id — reused across all MCP tool definitions.
// The regex /^[a-zA-Z0-9_-]+$/ prevents path traversal in memory file paths.
export const AGENT_ID_SCHEMA = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .max(64);
