## design-system

# Design System

## Tailwind CSS
- Version: Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no separate tailwind.config file needed)
- Setup: imported as `@import "tailwindcss"` in `index.css`; configured via Vite plugin in `vite.config.ts`
- No custom design tokens or theme extensions found; uses Tailwind's default palette

## Color Palette (in use)
- **Background**: `gray-950` (app root), `gray-900` (agent status bar), `gray-800` (cards/panels)
- **Borders**: `gray-800`, `gray-700`
- **Text (primary)**: `white`, `gray-200`, `gray-300`
- **Text (secondary/muted)**: `gray-400`, `gray-500`, `gray-600`
- **Status — connected**: `bg-green-900 text-green-300`
- **Status — disconnected**: `bg-red-900 text-red-300`
- **Status — working agent**: `bg-green-900 text-green-300`, indicator dot `bg-green-400 animate-pulse`
- **Status — idle agent**: `bg-gray-800 text-gray-400`, indicator dot `bg-gray-600`
- **Selected agent**: `ring-2 ring-blue-400`

## Agent Color Coding (MessageFeed)
| Agent    | Color class       |
|----------|-------------------|
| pm       | text-purple-400   |
| designer | text-pink-400     |
| da       | text-yellow-400   |
| fe       | text-blue-400     |
| be       | text-green-400    |
| qa       | text-orange-400   |
| deployer | text-orange-400   |

## Priority Color Dots (TaskBoard)
| Priority | Color class   |
|----------|---------------|
| critical | bg-red-500    |
| high     | bg-orange-400 |
| medium   | bg-yellow-400 |
| low      | bg-gray-400   |

## Typography
- No custom font — uses Tailwind's default sans stack
- `AgentThoughts` panel uses `font-mono` for terminal-style output
- Section headers: `text-xs font-semibold text-gray-400 uppercase`
- Card text: `text-sm`

## Animation
- `animate-pulse` used for: working agent status dot, AgentThoughts cursor blink
## ui-patterns

# UI Patterns

## Layout
- Root: `h-screen flex flex-col` — full viewport height, vertical stack
- Three-panel main area: `flex flex-1 overflow-hidden divide-x divide-gray-800`
  - Each panel: `w-1/3 overflow-hidden`, with a sticky header row and scrollable content area
  - Scrollable area uses `h-[calc(100%-33px)] overflow-y-auto`

## Panel Structure Pattern
Each of the three panels follows this structure:
```
<div class="w-1/3 overflow-hidden">
  <div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-gray-800">
    Panel Title
  </div>
  <div class="h-[calc(100%-33px)] overflow-y-auto">
    {content}
  </div>
</div>
```

## Card Pattern
- Cards: `bg-gray-800 rounded-lg p-2.5 text-sm` (TaskBoard) / `bg-gray-800 rounded-lg p-3 text-sm` (MessageFeed)
- Consistent dark surface card with rounded corners; no shadows

## Agent Status Bar
- Horizontal pill row: `flex gap-3 p-3 bg-gray-900 border-b border-gray-700`
- Agent pill: `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all`
- Uses emoji + name + status dot within each pill
- Selected state: `ring-2 ring-blue-400`

## Connection Status Badge
- `text-xs px-2 py-1 rounded-full` with conditional color (green / red)

## Kanban Board (TaskBoard)
- Column layout: `flex gap-3 p-3 h-full overflow-x-auto`
- Columns: `flex-1 min-w-40`, stacked cards with `flex flex-col gap-2`
- Column headers: `text-xs font-semibold text-gray-400 uppercase mb-2` with count
- Status columns: `todo`, `in_progress`, `in_review`, `done`

## Agent Thoughts Panel
- Full-height flex column; header + scrollable body
- Body: `font-mono text-sm text-green-300 leading-relaxed` — terminal aesthetic
- Blinking cursor: `inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5`
- Auto-scrolls to bottom on new content via `useEffect` + `scrollIntoView`

## Auto-Scroll Pattern
Both `MessageFeed` and `AgentThoughts` use the same pattern:
- Anchor `<div ref={bottomRef} />` placed at end of list
- `useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [dependency])`

## Empty States
- MessageFeed: `text-gray-600 text-sm text-center mt-8` — "No messages yet"
- AgentThoughts waiting: `text-gray-600` — "Waiting..."

## Component Files
- `App.tsx` — root layout, state management via `useReducer`
- `AgentStatusBar.tsx` — fetches agent list from `/api/agents`, renders pill row
- `TaskBoard.tsx` — Kanban columns, groups tasks by status
- `MessageFeed.tsx` — chronological message list, auto-scroll
- `AgentThoughts.tsx` — streaming terminal view for selected agent

## State Management
- Single `useReducer` in `App.tsx` handles all dashboard state
- WebSocket events dispatched via `useRelaySocket` hook
- No external state library (no Redux/Zustand)
