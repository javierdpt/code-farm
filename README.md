# Code Farm

A self-hosted web platform that orchestrates Claude Code development containers across multiple machines. Paste a ticket URL from GitHub (Azure DevOps/Trello/Monday planned), and it spins up a Podman container on a registered worker machine, clones the repo, generates a `CLAUDE.md` with ticket context, and gives you a full web terminal with nvim, tmux, and Claude Code — colors and all.

## Architecture

```
Browser (xterm.js)
    │  WebSocket
    ▼
Orchestrator (Next.js 15 + custom WS server)
    │  WebSocket (phone-home)
    ▼
Worker Agents (one per machine, Podman CLI)
    │  child_process.spawn
    ▼
Podman Containers (claude-code, gh, tmux, nvim)
```

Workers connect **outbound** to the orchestrator — this means they work behind NAT and firewalls with zero port forwarding.

## Prerequisites

- **Node.js 22+** and **npm 10+**
- **Podman** installed on every worker machine
- (Optional) A **GitHub personal access token** for higher API rate limits

## Quick Start

### 1. Install dependencies

```bash
git clone <repo-url> code-farm
cd code-farm
npm install
```

### 2. Build the dev workspace container image

This is the Podman image that gets launched for each ticket. It includes Claude Code, git, tmux, neovim, and GitHub CLI.

```bash
podman build -t localhost/claude-code:latest \
  -f containers/dev-workspace/Containerfile .
```

### 3. Start the orchestrator

```bash
npm run dev
```

This starts the orchestrator on `http://localhost:3000` with WebSocket endpoints for workers and browser terminals.

### 4. Start a worker agent

In a separate terminal (on the same machine or any machine that can reach the orchestrator):

```bash
cd apps/worker-agent
ORCHESTRATOR_URL=ws://localhost:3000/ws/worker \
WORKER_NAME=my-machine \
npm run dev
```

The worker connects to the orchestrator and registers itself. You should see it appear on the dashboard at `http://localhost:3000`.

### 5. Launch a container

Open `http://localhost:3000/launch`, paste a GitHub issue URL (e.g. `https://github.com/owner/repo/issues/42`), and click **Launch**. The system will:

1. Fetch the ticket details from GitHub
2. Generate a `CLAUDE.md` with the ticket context
3. Spin up a Podman container on the least-loaded worker
4. Give you a web terminal connected to the container

## Project Structure

```
code-farm/
├── apps/
│   ├── orchestrator/              # Next.js 15 + custom WS server
│   │   ├── server.ts              # HTTP server with WS upgrade handling
│   │   ├── Containerfile          # Production container build
│   │   └── src/
│   │       ├── app/               # Pages + API routes
│   │       ├── components/        # React components
│   │       └── lib/               # WS manager, worker registry, relay
│   └── worker-agent/              # Standalone Node.js agent
│       ├── Containerfile          # Reference container build
│       └── src/
│           ├── index.ts           # Entry point
│           ├── config.ts          # Environment-based config
│           ├── ws-client.ts       # WS client with reconnect
│           ├── heartbeat.ts       # System stats reporter
│           ├── container-manager.ts  # Podman CLI wrapper
│           ├── terminal-manager.ts   # PTY session manager
│           └── repo-setup.ts      # Clone + CLAUDE.md writer
├── packages/
│   ├── shared/                    # Zod schemas, types, constants
│   ├── ticket-providers/          # GitHub Issues (full), stubs for others
│   └── claude-md-generator/       # Ticket → CLAUDE.md
├── containers/
│   └── dev-workspace/Containerfile
└── podman-compose.yml
```

## Environment Variables

### Orchestrator

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP/WS server port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `development` | Set to `production` for prod builds |

### Worker Agent

| Variable | Default | Description |
|----------|---------|-------------|
| `ORCHESTRATOR_URL` | `ws://localhost:3000/ws/worker` | WebSocket URL of the orchestrator |
| `WORKER_NAME` | System hostname | Human-readable name for this worker |
| `CONTAINER_IMAGE` | `localhost/claude-code:latest` | Podman image for dev containers |

### Ticket Providers

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | _(none)_ | GitHub personal access token for API access. Without it you get 60 req/hr; with it, 5000 req/hr |

## Web UI Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — overview of workers and containers |
| `/launch` | Paste a ticket URL to launch a new container |
| `/containers` | List all containers across all workers |
| `/containers/[id]` | Container detail with embedded terminal |
| `/terminal/[id]` | Fullscreen terminal (zero chrome) |

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/workers` | List all registered workers |
| `GET` | `/api/containers` | List all containers |
| `POST` | `/api/containers` | Create a container directly |
| `GET` | `/api/containers/[id]` | Get container details |
| `DELETE` | `/api/containers/[id]` | Stop and remove a container |
| `POST` | `/api/launch` | Full launch flow: fetch ticket → generate CLAUDE.md → create container |

### POST /api/launch

```json
{
  "ticketUrl": "https://github.com/owner/repo/issues/42",
  "workerName": "my-mac",
  "extraInstructions": "Focus on performance"
}
```

Only `ticketUrl` is required. If `workerName` is omitted, the least-loaded online worker is selected.

## WebSocket Endpoints

| Path | Purpose |
|------|---------|
| `ws://host:3000/ws/worker` | Worker agent connection (phone-home) |
| `ws://host:3000/ws/terminal?containerId=X&workerId=Y` | Browser terminal session |

## Podman Labels

Containers are the source of truth. No database — all state is stored as Podman labels:

```
claude-farm.managed=true
claude-farm.ticket-url=https://github.com/org/repo/issues/42
claude-farm.ticket-title=Fix rate limiter
claude-farm.repo-url=https://github.com/org/repo
claude-farm.branch=fix/42-rate-limiter
claude-farm.created-at=2026-02-28T10:00:00Z
claude-farm.worker-id=<uuid>
claude-farm.worker-name=my-mac
```

Query managed containers: `podman ps -a --filter label=claude-farm.managed=true --format json`

## Supported Ticket Providers

| Provider | Status | URL Pattern |
|----------|--------|-------------|
| GitHub Issues | Implemented | `github.com/{owner}/{repo}/issues/{number}` |
| Azure DevOps | Stub | `dev.azure.com/...` or `*.visualstudio.com/...` |
| Trello | Stub | `trello.com/...` |
| Monday.com | Stub | `monday.com/...` |

## Development

```bash
# Install dependencies
npm install

# Start everything in dev mode (orchestrator + worker hot-reload)
npm run dev

# Build all packages
npm run build

# Clean build artifacts
npm run clean
```

### Building individual packages

```bash
# Build just the shared types
npm run build -w packages/shared

# Build the orchestrator
npm run build -w apps/orchestrator

# Build the worker agent
npm run build -w apps/worker-agent
```

## Production Deployment

### Option 1: podman-compose (orchestrator only)

```bash
podman-compose up -d
```

This runs the orchestrator in a container on port 3000. Workers still need to run on the host (see below).

### Option 2: Build and run manually

```bash
# Build everything
npm run build

# Start orchestrator
cd apps/orchestrator
NODE_ENV=production node .next/standalone/apps/orchestrator/server.js

# Install and start worker (on each machine)
ORCHESTRATOR_URL=ws://orchestrator-host:3000/ws/worker \
WORKER_NAME=worker-1 \
worker-agent
```

### Option 3: Build container images

```bash
# Orchestrator image
podman build -t code-farm-orchestrator -f apps/orchestrator/Containerfile .

# Run it
podman run -d -p 3000:3000 --name orchestrator code-farm-orchestrator
```

## Installing the Worker Agent

The worker agent can be installed as a global CLI from a cloned copy of the repo. This works on Mac, Windows, and Linux.

```bash
# Clone and install
git clone <repo-url> code-farm
cd code-farm
npm install
npm run install:worker
```

This builds the shared packages, compiles the worker agent, and installs it globally. You can now run `worker-agent` from anywhere:

```bash
ORCHESTRATOR_URL=ws://orchestrator-host:3000/ws/worker \
WORKER_NAME=my-machine \
worker-agent
```

On Windows (PowerShell):

```powershell
$env:ORCHESTRATOR_URL="ws://orchestrator-host:3000/ws/worker"
$env:WORKER_NAME="my-machine"
worker-agent
```

To uninstall:

```bash
npm uninstall -g @code-farm/worker-agent
```

## Multi-Machine Setup

1. Deploy the orchestrator on a machine reachable by all workers
2. On each worker machine:
   - Install Node.js 22+ and Podman
   - Build the dev workspace image: `podman build -t localhost/claude-code:latest -f containers/dev-workspace/Containerfile .`
   - Clone this repo and install the worker agent: `cd code-farm && npm install && npm run install:worker`
   - Start the agent: `ORCHESTRATOR_URL=ws://orchestrator-ip:3000/ws/worker WORKER_NAME=machine-name worker-agent`
3. Workers connect outbound — no inbound ports needed on worker machines

## Tech Stack

| Concern | Choice |
|---------|--------|
| Monorepo | npm workspaces |
| Orchestrator | Next.js 15, App Router, custom `server.ts` |
| Worker Agent | Standalone Node.js/TypeScript |
| Terminal (browser) | xterm.js with fit addon |
| WebSocket | `ws` library (raw, not Socket.IO) |
| Styling | Tailwind CSS v4, VS Code Dark theme |
| Validation | Zod schemas for all WS messages |
| Containers | Podman |
| Database | None — Podman labels + in-memory state |

## No Auth (POC)

This is a proof-of-concept. There is no authentication — the orchestrator, workers, and web UI are all open. Add auth before exposing to the internet.

## License

Private / Internal
