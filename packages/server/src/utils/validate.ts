// packages/server/src/utils/validate.ts
// SECURITY CRITICAL: Do NOT alter the regex anchors /^[a-zA-Z0-9_-]+$/.
// This is used for path construction — altering anchors enables path traversal.
export function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}
