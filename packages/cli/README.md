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
