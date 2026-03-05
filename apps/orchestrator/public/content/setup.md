# Setup Guide

Code Farm orchestrates Claude Code development containers across multiple machines. This guide covers how to set up the orchestrator and connect worker agents.

## Architecture

```
Browser (xterm.js)
    |  WebSocket
    v
Orchestrator (this app - Next.js + WS server)
    |  WebSocket (phone-home)
    v
Worker Agents (one per machine)
    |  child_process
    v
Podman Containers (claude-code, gh, tmux, nvim)
```

Workers connect **outbound** to the orchestrator -- they work behind NAT and firewalls with zero port forwarding.

## Prerequisites

On the **orchestrator** machine:

- Node.js 22+ and npm 10+

On every **worker** machine:

- Node.js 22+ and npm 10+
- Podman installed and running
- Network access to the orchestrator (outbound only)

## Quick Start with `code-farm-cli`

The easiest way to run Code Farm is with the global CLI:

```bash
git clone <repo-url> code-farm
cd code-farm
npm install
npm run install:cli
```

Then from anywhere:

```bash
# Start both orchestrator and worker
code-farm-cli start

# Or start components individually
code-farm-cli start orchestrator
code-farm-cli start worker
```

> **Note:** When no `ORCHESTRATOR_URL` is set, the worker defaults to `ws://localhost:3000/ws/worker` — so it automatically connects to an orchestrator running on the same machine. For remote workers on a different machine, set the environment variable before starting:
>
> ```bash
> ORCHESTRATOR_URL=ws://<orchestrator-ip>:3000/ws/worker code-farm-cli start worker
> ```

## 1. Start the Orchestrator

The orchestrator is the central hub. It serves the web UI and manages all WebSocket connections.

**Using the CLI (preferred):**

```bash
code-farm-cli start orchestrator
```

**Using npm directly:**

```bash
cd code-farm
npm run dev
```

The orchestrator starts on `http://localhost:3000`.

## 2. Install the Worker Agent

The worker agent runs on each machine that will host containers. Install it as a global CLI:

```bash
git clone <repo-url> code-farm
cd code-farm
npm install
npm run install:worker
```

This builds and installs the `worker-agent` command globally.

> **Tip:** If you installed `code-farm-cli` above, you can also start the worker in dev mode with `code-farm-cli start worker`.

## 3. Build the Dev Workspace Image

On each worker machine, build the Podman image that gets launched for each ticket:

```bash
podman build -t localhost/claude-code-dev:latest \
  -f containers/dev-workspace/Containerfile .
```

This image includes Claude Code, git, tmux, neovim, and GitHub CLI.

## 4. Start the Worker Agent

### Mac / Linux

```bash
ORCHESTRATOR_URL=ws://<orchestrator-host>:3000/ws/worker \
WORKER_NAME=my-machine \
worker-agent
```

### Windows (PowerShell)

```powershell
$env:ORCHESTRATOR_URL="ws://<orchestrator-host>:3000/ws/worker"
$env:WORKER_NAME="my-machine"
worker-agent
```

The worker connects to the orchestrator and registers itself. You should see it appear on the Dashboard.

> **Note:** If no `ORCHESTRATOR_URL` is set, the worker defaults to `ws://localhost:3000/ws/worker` (same machine). Replace `<orchestrator-host>` with the actual IP or hostname when running on a different machine.

## 5. Launch a Container

1. Open the orchestrator at `http://localhost:3000/launch`
2. Paste a GitHub issue URL (e.g. `https://github.com/owner/repo/issues/42`)
3. Click **Launch**

The system will:

1. Fetch the ticket details from GitHub
2. Generate a `CLAUDE.md` with the ticket context
3. Spin up a Podman container on the least-loaded worker
4. Give you a web terminal connected to the container

## Environment Variables

### Orchestrator

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP/WS server port |
| `HOST` | `0.0.0.0` | Bind address |

### Worker Agent

| Variable | Default | Description |
|----------|---------|-------------|
| `ORCHESTRATOR_URL` | `ws://localhost:3000/ws/worker` | WebSocket URL of the orchestrator |
| `WORKER_NAME` | System hostname | Name for this worker |
| `CONTAINER_IMAGE` | `localhost/claude-code-dev:latest` | Podman image for dev containers |

### Ticket Providers

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | _(none)_ | GitHub personal access token (without: 60 req/hr, with: 5000 req/hr) |

## How the Worker Agent Works

The worker agent is a lightweight Node.js daemon that:

1. **Connects** to the orchestrator via WebSocket (outbound)
2. **Registers** itself with system info (hostname, CPU count, RAM)
3. **Sends heartbeats** every 10 seconds (CPU usage, free memory, container count)
4. **Receives commands** from the orchestrator:
   - `container.create` -- runs `podman run` to start a new dev container
   - `container.stop` -- stops and removes a container
   - `terminal.open` -- starts an interactive shell via `podman exec -it`
   - `terminal.input` -- forwards keystrokes to the shell
   - `terminal.resize` -- resizes the terminal dimensions
5. **Streams terminal output** back to the orchestrator, which relays it to the browser

If the connection drops, the agent automatically reconnects with exponential backoff (1s, 2s, 4s, ... up to 30s).

## Stopping and Managing the Worker Agent

### Stop the Worker

If running in the foreground, press `Ctrl+C`. The agent handles shutdown gracefully — it stops heartbeats, closes terminal sessions, and disconnects from the orchestrator.

If running in the background:

```bash
# Find and stop the worker process
kill $(pgrep -f worker-agent)
```

### Check if a Worker Is Running

```bash
pgrep -fl worker-agent
```

### Run as a Background Service (macOS launchd)

Create `~/Library/LaunchAgents/com.code-farm.worker-agent.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.code-farm.worker-agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/worker-agent</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ORCHESTRATOR_URL</key>
    <string>ws://orchestrator-host:3000/ws/worker</string>
    <key>WORKER_NAME</key>
    <string>my-machine</string>
  </dict>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/worker-agent.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/worker-agent.err</string>
</dict>
</plist>
```

Then load/unload it:

```bash
# Start the service
launchctl load ~/Library/LaunchAgents/com.code-farm.worker-agent.plist

# Stop the service
launchctl unload ~/Library/LaunchAgents/com.code-farm.worker-agent.plist
```

### Run as a Background Service (Linux systemd)

Create `/etc/systemd/system/code-farm-worker.service`:

```ini
[Unit]
Description=Code Farm Worker Agent
After=network.target

[Service]
Type=simple
Environment=ORCHESTRATOR_URL=ws://orchestrator-host:3000/ws/worker
Environment=WORKER_NAME=my-machine
ExecStart=/usr/local/bin/worker-agent
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then manage it:

```bash
# Start
sudo systemctl start code-farm-worker

# Stop
sudo systemctl stop code-farm-worker

# Enable auto-start on boot
sudo systemctl enable code-farm-worker

# Check status
sudo systemctl status code-farm-worker

# View logs
journalctl -u code-farm-worker -f
```

## Uninstalling the Worker Agent

```bash
npm uninstall -g @javierdpt/code-farm-worker-agent
```

To also remove the service (if configured):

```bash
# macOS
launchctl unload ~/Library/LaunchAgents/com.code-farm.worker-agent.plist
rm ~/Library/LaunchAgents/com.code-farm.worker-agent.plist

# Linux
sudo systemctl stop code-farm-worker
sudo systemctl disable code-farm-worker
sudo rm /etc/systemd/system/code-farm-worker.service
sudo systemctl daemon-reload
```

## Multi-Machine Setup

1. Deploy the orchestrator on a machine reachable by all workers
2. On each worker machine:
   - Install Node.js 22+ and Podman
   - Build the dev workspace image
   - Install the worker agent: `npm run install:worker`
   - Start it: `ORCHESTRATOR_URL=ws://<orchestrator-ip>:3000/ws/worker worker-agent`
3. Workers connect outbound -- no inbound ports needed on worker machines
