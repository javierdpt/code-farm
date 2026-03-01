# Claude Farm - Implementation Plan

## Context

Build a self-hosted web platform ("Claude Farm") that orchestrates Claude Code development containers across multiple machines. Paste a ticket URL from GitHub/Azure DevOps/Trello/Monday, and it spins up a Podman container on a registered worker machine, clones the repo, generates a CLAUDE.md with ticket context, and gives you a full web terminal (nvim, tmux, Claude Code with colors). No database — Podman labels are the source of truth. No auth for the POC.

## Architecture

```
Browser (xterm.js)
    |  WebSocket
    v
Orchestrator (Next.js 15 + custom WS server)
    |  WebSocket (phone-home)
    v
Worker Agents (one per machine, Podman CLI)
    |  node-pty
    v
Podman Containers (claude-code, gh, tmux, nvim)
```

- Workers connect **outbound** to orchestrator (works behind NAT/firewalls)
- Terminal data: browser → WS → orchestrator relay → WS → worker → node-pty → `podman exec -it`
- Custom `server.ts` wraps Next.js to handle WS `upgrade` events (Next.js App Router doesn't support WS natively)
- Use `ws` library (not Socket.IO) for raw binary terminal streams

### Worker Agent

The worker-agent is a lightweight Node.js process that runs on each machine in your farm (Mac, Windows, cloud VM — any machine with Podman installed). It:

1. **Connects outbound** to the orchestrator via WebSocket ("phone home" model — works behind NAT/firewalls)
2. **Receives commands** from the orchestrator — "create container", "stop container", "open terminal session"
3. **Executes Podman locally** — runs `podman run`, `podman exec`, `podman stop` on the host machine
4. **Relays terminal I/O** — spawns a PTY (via node-pty) attached to `podman exec -it` and pipes input/output back to the orchestrator

You start it once per machine:
```bash
ORCHESTRATOR_URL=ws://orchestrator:3000/ws/worker \
WORKER_NAME=my-mac \
node worker-agent/dist/index.js
```

For the POC, run it directly on the host (not containerized) since it needs access to the host's Podman.

## Tech Stack

| Concern | Choice |
|---|---|
| Monorepo | Turborepo + npm workspaces |
| Orchestrator | Next.js 15, App Router, custom server.ts |
| Worker Agent | Standalone Node/TS app |
| Terminal (browser) | @xterm/xterm + @xterm/addon-fit + @xterm/addon-webgl |
| Terminal (server) | node-pty spawning `podman exec -it` |
| WebSocket | `ws` library (both server and client) |
| Styling | Tailwind CSS v4, VS Code Dark theme |
| Validation | Zod for WS message schemas |
| Containers | Podman (not Docker) everywhere |
| DB | None — Podman labels + in-memory worker state |

## Project Structure

```
claude-farm/
├── turbo.json
├── package.json              # npm workspaces defined here
├── tsconfig.base.json
├── apps/
│   ├── orchestrator/              # Next.js 15 + custom WS server
│   │   ├── server.ts              # Custom HTTP server with WS upgrade handling
│   │   ├── Containerfile
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx     # Root layout, dark theme, fonts
│   │       │   ├── page.tsx       # Dashboard
│   │       │   ├── globals.css    # VS Code dark theme CSS vars
│   │       │   ├── launch/page.tsx
│   │       │   ├── containers/page.tsx
│   │       │   ├── containers/[id]/page.tsx  # Container detail + terminal
│   │       │   ├── terminal/[id]/page.tsx    # FULLSCREEN terminal (no chrome)
│   │       │   └── api/
│   │       │       ├── workers/route.ts
│   │       │       ├── containers/route.ts
│   │       │       ├── containers/[id]/route.ts
│   │       │       └── launch/route.ts
│   │       ├── components/
│   │       │   ├── layout/ (sidebar, header, status-bar)
│   │       │   ├── terminal/
│   │       │   │   ├── terminal-panel.tsx       # Embeddable terminal component
│   │       │   │   ├── terminal-fullscreen.tsx  # Fullscreen wrapper (F11 / button toggle)
│   │       │   │   └── use-terminal.ts          # Hook: WS + xterm init
│   │       │   ├── workers/ (worker-card, worker-list)
│   │       │   ├── containers/ (container-card, container-list)
│   │       │   ├── launch/ (ticket-input, launch-config, launch-progress)
│   │       │   └── ui/ (button, input, badge, card, select, spinner)
│   │       ├── lib/
│   │       │   ├── ws-manager.ts        # Worker WS connection manager
│   │       │   ├── worker-registry.ts   # In-memory worker state
│   │       │   └── terminal-relay.ts    # Bridge browser WS <-> worker WS
│   │       └── types/index.ts
│   │
│   └── worker-agent/              # Standalone Node app
│       ├── Containerfile
│       └── src/
│           ├── index.ts           # Entry: connect, main loop
│           ├── ws-client.ts       # WS client + exponential backoff reconnect
│           ├── heartbeat.ts       # System stats reporting every 10s
│           ├── container-manager.ts # Podman CLI wrapper
│           ├── terminal-manager.ts  # node-pty session manager
│           ├── repo-setup.ts      # Clone, checkout, write CLAUDE.md
│           └── config.ts          # ENV-based config
│
├── packages/
│   ├── shared/                    # Types + validation
│   │   └── src/
│   │       ├── types/ (worker, container, terminal, ticket, messages)
│   │       ├── constants.ts
│   │       └── utils/ (message-factory, validators)
│   ├── ticket-providers/          # Pluggable ticket fetchers
│   │   └── src/
│   │       ├── provider.interface.ts
│   │       ├── github-issues.ts   # MVP: GitHub Issues
│   │       ├── azure-devops.ts    # Stub
│   │       ├── trello.ts          # Stub
│   │       ├── monday.ts          # Stub
│   │       └── index.ts           # Registry + resolveProvider(url)
│   └── claude-md-generator/       # Ticket → CLAUDE.md
│       └── src/
│           ├── generator.ts
│           └── templates/default.ts
│
├── containers/
│   └── dev-workspace/Containerfile  # Reference to existing claude-code image
└── podman-compose.yml
```

## VS Code Dark Theme

CSS variables + Tailwind custom colors:

```
--bg-primary: #1e1e1e       --text-primary: #d4d4d4
--bg-secondary: #252526     --text-secondary: #808080
--bg-tertiary: #2d2d2d      --accent-blue: #569cd6
--bg-input: #3c3c3c         --accent-teal: #4ec9b0
--border: #3c3c3c           --status-bar: #007acc
--hover: #2a2d2e            --error: #f44747
--selection: #264f78         --warning: #cca700
--active: #094771
```

xterm.js theme matches VS Code terminal palette (all 16 ANSI colors configured).

## Fullscreen Terminal Mode

Two ways to access terminals:
1. **Embedded** — `/containers/[id]` page shows terminal panel below container info
2. **Fullscreen** — `/terminal/[id]` is a dedicated fullscreen page with zero chrome

Fullscreen features:
- No sidebar, no header, no status bar — terminal takes 100vh x 100vw
- Floating toolbar (auto-hides, appears on mouse move to top): container name, back button, disconnect
- Toggle between embedded and fullscreen via button or keyboard shortcut (F11)
- `@xterm/addon-fit` auto-resizes on window resize
- Browser fullscreen API integration (optional, F11 also triggers native fullscreen)

## WebSocket Protocol

Messages are JSON with `type` discriminator. Terminal data uses base64-encoded binary.

### Worker <-> Orchestrator

```
worker.register    -> worker.accepted     (connection setup)
worker.heartbeat                         (every 10s)
container.create   -> container.created   (request/response via requestId)
container.stop     -> container.stopped
container.list     -> container.list.response
terminal.open      -> terminal.opened
terminal.input     -> (forwarded to PTY)
terminal.output    -> (forwarded to browser)
terminal.resize    -> (forwarded to PTY)
terminal.close     -> terminal.closed
```

### Browser -> Orchestrator (terminal WS)

Browser connects to `ws://host/ws/terminal?containerId=X&workerId=Y`. Raw binary frames for terminal I/O (not JSON-wrapped). Resize sent as JSON `{ type: 'resize', cols, rows }`.

## Ticket -> Container Flow

1. User pastes ticket URL in `/launch` page
2. URL pattern matching detects provider (github.com -> GitHubProvider)
3. Provider fetches: title, description, labels, comments, repo, branch
4. `claude-md-generator` renders CLAUDE.md from normalized ticket data
5. Orchestrator picks a worker (least loaded or user-selected)
6. Worker creates container: `podman run` with `claude-farm.*` labels
7. Worker clones repo, checks out branch, writes CLAUDE.md
8. Container is ready — user clicks through to terminal

## Podman Labels (Source of Truth)

```
claude-farm.managed=true
claude-farm.ticket-url=https://github.com/org/repo/issues/42
claude-farm.ticket-title=Fix rate limiter
claude-farm.repo-url=https://github.com/org/repo
claude-farm.branch=fix/42-rate-limiter
claude-farm.created-at=2026-02-28T10:00:00Z
claude-farm.worker-id=worker-uuid
```

Query: `podman ps -a --filter label=claude-farm.managed=true --format json`

## Implementation Phases

### Phase 1: Foundation
Monorepo setup (npm workspaces in root package.json), shared types with Zod schemas, worker agent WS client with reconnect, orchestrator custom server.ts with WS upgrade, worker registry (in-memory), `GET /api/workers` endpoint.

**Verify**: Worker connects, heartbeats flow, `/api/workers` returns worker list.

### Phase 2: Container Lifecycle
`container-manager.ts` (Podman CLI wrapper), WS command handlers on worker, request/response correlation on orchestrator, REST endpoints for containers.

**Verify**: `POST /api/containers` creates a container with labels, `GET /api/containers` lists them, `DELETE` stops/removes.

### Phase 3: Terminal
`terminal-manager.ts` (node-pty + `podman exec -it`), terminal relay on orchestrator, `useTerminal` hook with xterm.js, `<TerminalPanel>` component, fullscreen terminal page, VS Code dark theme terminal palette.

**Verify**: Open terminal in browser, run tmux/nvim/claude — all render correctly with colors. Fullscreen mode works. Resize works.

### Phase 4: Ticket Providers + Launch Flow
GitHub Issues provider, CLAUDE.md generator, `POST /api/launch` endpoint, `repo-setup.ts` on worker (clone, checkout, write CLAUDE.md), launch page UI with progress.

**Verify**: Paste a GitHub issue URL -> container launches with CLAUDE.md containing ticket context.

### Phase 5: UI Polish + Dashboard
All UI components with VS Code dark theme, sidebar navigation, dashboard with worker/container overview, status bar, real-time updates via WS.

**Verify**: Dashboard reflects worker/container state in real-time, theme matches VS Code dark exactly.

### Phase 6: Containerization
Orchestrator Containerfile, podman-compose.yml, worker-agent deployment docs.

**Verify**: Full end-to-end flow running in containers.

## Key Dependencies

- `next@15`, `react@19`, `react-dom@19`
- `ws@8` (WS server + client)
- `@xterm/xterm@6`, `@xterm/addon-fit`, `@xterm/addon-webgl`
- `node-pty@1` (native module — needs build tools on host)
- `tailwindcss@4`
- `zod@3`
- `turbo@2`

## Package Manager

npm workspaces (not pnpm). Workspaces defined in root `package.json`:
```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```
Use `npm install`, `npx turbo build`, etc.

## No Auth (POC)

No authentication layer for the POC. Orchestrator and workers communicate without tokens. Web UI has no login. This is intentional — auth is a Phase 7 concern when deploying to cloud.
