# @code-farm/cli

> **TL;DR** — Global CLI to start Code Farm components from anywhere.

## Installation

```bash
git clone <repo-url> code-farm
cd code-farm
npm install
npm run install:cli
```

## Usage

```bash
# Start both orchestrator and worker
code-farm-cli start

# Start only the orchestrator
code-farm-cli start orchestrator

# Start only the worker
code-farm-cli start worker

# Build all packages and apps
code-farm-cli build
```

Logs are prefixed with colored labels (`[orchestrator]`, `[worker]`). Press `Ctrl+C` to shut down all processes cleanly.

> **Note:** The worker defaults to `ws://localhost:3000/ws/worker` when no `ORCHESTRATOR_URL` is set, so it automatically connects to an orchestrator on the same machine. For remote workers, set the env var first:
>
> ```bash
> ORCHESTRATOR_URL=ws://<orchestrator-ip>:3000/ws/worker code-farm-cli start worker
> ```
