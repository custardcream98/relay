# FE Agent Memory

## tech-stack

- **React**: 19.2.4 (latest, with `useReducer`, `useCallback`, `useEffect`, `useRef`, `useState`, `useMemo`)
- **Vite**: 8.x with `@vitejs/plugin-react` 6.x
- **Tailwind CSS**: 4.x via `@tailwindcss/vite` plugin (v4 API — no `tailwind.config.js`, imported directly in CSS via `@import "tailwindcss"`)
- **TypeScript**: ~5.9.3, strict mode, separate `tsconfig.app.json` / `tsconfig.node.json`
- **No routing library** — single-page dashboard, no React Router
- **No state management library** — uses React's built-in `useReducer` for global state
- **No external component library** — all UI built from scratch
- **Fonts**: Inter (sans) + JetBrains Mono (mono) via Google Fonts
- **Shared types**: `@custardcream/relay-shared` (workspace package, path-aliased in vite config)
- **Dev proxy**: Vite proxies `/api` and `/ws` to `http://localhost:3456` (relay server)
- **Build output**: `dist/` (served by Hono in packages/server)

## component-patterns

### File structure
```
src/
├── App.tsx              # Root component — layout + global state
├── main.tsx             # Entry point (StrictMode)
├── index.css            # CSS variables + Tailwind + global styles
├── types.ts             # Re-exports from @custardcream/relay-shared
├── components/
│   ├── AgentStatusBar.tsx   # Horizontal agent chip bar (fetches /api/agents on mount)
│   ├── AgentThoughts.tsx    # Streaming thought panel with auto-scroll + cursor
│   ├── MessageFeed.tsx      # Slack-style message list with markdown rendering
│   ├── TaskBoard.tsx        # 4-column Kanban board (todo/in_progress/in_review/done)
│   └── MarkdownContent.tsx  # Dependency-free inline markdown renderer
├── hooks/
│   ├── useRelaySocket.ts    # WebSocket hook with exponential back-off reconnect
│   └── useResizablePanels.ts # Drag-to-resize 3-panel layout hook
└── constants/
    └── agents.ts            # AGENT_ACCENT_HEX color map per agent ID
```

### State architecture
- Global dashboard state managed in `App.tsx` via `useReducer`
- `DashboardState`: tasks[], messages[], agentStatuses, thinkingChunks, selectedAgent
- Actions: `EVENT` (maps RelayEvent union to state updates) + `SELECT_AGENT`
- WebSocket events drive all state updates — no polling

### Component style
- All components receive typed props interfaces (no default exports except App)
- Inline styles used extensively for design-token values (CSS custom properties)
- Tailwind utility classes used for layout/spacing/flex
- Hover effects done via `onMouseEnter`/`onMouseLeave` handlers (not Tailwind hover:)
- No CSS modules, no styled-components

### Key patterns
- `useRelaySocket`: manages WebSocket lifecycle, exponential back-off (1s→2s→4s→8s→16s), uses `useRef` for stable callbacks
- `useResizablePanels`: tracks drag state with refs, normalizes panel widths to 100%, min panel width 12%
- `MarkdownContent`: custom parser supporting code blocks, H1-H3, tables, lists, bold/italic/inline-code — no dependencies
- `AgentThoughts`: auto-scroll with "user scrolled up" detection (pauses auto-scroll when >60px from bottom)

## conventions

### Styling system
- Dark/light theme support — CSS custom properties defined in `:root` (dark) and `[data-theme="light"]` in `index.css`; toggle via `useTheme.ts` hook + `AppHeader` toggle button
- Token naming: `--color-surface-{root|base|raised|overlay|inset}`, `--color-text-{primary|secondary|tertiary|disabled}`, `--color-border-{subtle|default|strong}`
- Per-agent accent colors: `--color-accent-{pm|designer|da|fe|be|qa|deployer}` (also in `AGENT_ACCENT_HEX` constant)
- Status colors: `--color-status-{working|waiting|idle}` + `--color-connection-{live|dead}`
- Shadows: `--shadow-card` / `--shadow-card-hover`
- Animations: `scale-pulse` (working status dot), `blink` (idle cursor)

### Component conventions
- Named exports for all components (except `App` which is default export)
- Local `interface Props` or inline prop types per component
- Korean comments for layout/design intent annotations
- Each file has a `// path/to/file.ts` header comment
- `biome-ignore` lint suppressions with explanation when needed

### API integration
- REST: `/api/agents` → agent metadata (id, name, emoji)
- WebSocket: `/ws` → `RelayEvent` JSON stream
- Types imported from `@custardcream/relay-shared`

### No external UI dependencies
- No icon library (SVG inline in JSX)
- No markdown library (custom `MarkdownContent` component)
- No date/time library (`toLocaleTimeString` native)
- No drag-and-drop library (custom mouse event handling)
