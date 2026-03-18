// packages/server/src/utils/mcp-response.ts
// Shared MCP tool response builder — eliminates the repetitive
// `{ content: [{ type: "text", text: JSON.stringify(result) }] }` boilerplate.

/**
 * Wraps a plain object into the MCP tool response envelope.
 * Every MCP tool handler must return this shape.
 */
export function jsonResponse(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}
