// packages/dashboard/src/utils/url.ts
// Strip trailing slash from a server base URL so /api paths are constructed correctly

export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}
