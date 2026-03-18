// packages/server/src/schemas.ts
// Shared Zod schemas for MCP tool parameter validation.
// Centralized here to prevent regex drift across register-*.ts files.
import { z } from "zod";

// The regex /^[a-zA-Z0-9_-]+$/ prevents path traversal in memory file paths.
export const AGENT_ID_SCHEMA = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .max(64);

export const SESSION_ID_SCHEMA = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .max(128);

export const TASK_ID_SCHEMA = z.string().max(128);

export const GENERIC_ID_SCHEMA = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .max(256);
