---
"@custardcream/relay": minor
"@custardcream/relay-dashboard": minor
---

### Branding consistency
- Dashboard: favicon, relay star icon in AppHeader, title "relay dashboard", wordmark letter-spacing unified to -0.02em
- Docs: Starlight sidebar logo (light/dark SVG variants), favicon icon in landing Nav and Footer

### Port binding fix
- `isPortAvailable` now binds on all interfaces (matching `serve()` behavior) to prevent IPv4/IPv6 mismatch
- New `tryServe()` retries with the next port on EADDRINUSE instead of silently failing

### Session selector removal
- Removed SessionSelector UI — redundant now that each server process gets its own dashboard port

### Artifact detail modal
- Click artifact cards in the Activity Feed to view full content in a popover modal
- New `GET /api/artifacts/:id` REST endpoint returns artifact with full content
- Storybook stories added for ArtifactDetailModal, ActivityFeed, and AppLayout
