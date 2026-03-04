# Code Farm — Worker Agent

The worker agent is a lightweight Node.js process that runs on each machine in your farm. It connects outbound to the orchestrator, receives commands, and manages Podman containers and terminal sessions locally.

## How It Works

```
                        ┌─────────────────────────┐
                        │       Orchestrator       │
                        │   ws://host:3000/ws/worker│
                        └────────────▲────────────┘
                                     │ WebSocket (outbound)
                                     │
┌────────────────────────────────────┴──────────────────────────────┐
│  Worker Agent (runs on host)                                      │
│                                                                   │
│  ┌──────────┐  ┌───────────────┐  ┌───────────────┐             │
│  │ WS Client│  │  Container    │  │   Terminal    │             │
│  │ reconnect│  │  Manager      │  │   Manager     │             │
│  │ + heartbt│  │  (podman CLI) │  │ (child_process│             │
│  └──────────┘  └───────────────┘  │  + podman exec│             │
│                       │           └───────────────┘             │
│                       ▼                    ▼                     │
│              ┌─────────────┐    ┌─────────────────┐             │
│              │   Podman    │    │  Terminal PTY    │             │
│              │  Containers │    │  Sessions        │             │
│              └─────────────┘    └─────────────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

1. **Connects outbound** to the orchestrator via WebSocket (works behind NAT/firewalls)
2. **Receives commands** — create container, stop container, open terminal session
3. **Executes Podman locally** — `podman run`, `podman exec`, `podman stop`
4. **Relays terminal I/O** — spawns a child process attached to `podman exec -it` and pipes input/output back

## Prerequisites

- **Node.js 22+** and **npm 10+**
- **Podman** installed and accessible from the command line
- The **dev workspace container image** built locally:

```bash
# From the repo root
podman build -t localhost/claude-code-dev:latest \
  -f containers/dev-workspace/Containerfile .
```

Verify Podman is working:

```bash
podman run --rm localhost/claude-code-dev:latest echo "OK"
```

## Installation

```bash
# From the repo root
npm install
npx turbo build --filter=@javierdpt/code-farm-worker-agent...
```

This builds the shared types package and the worker agent.

## Configuration

All configuration is via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ORCHESTRATOR_URL` | No | `ws://localhost:3000/ws/worker` | WebSocket URL of the orchestrator. Use `ws://` for plain or `wss://` for TLS. |
| `WORKER_NAME` | No | System hostname | A human-readable name for this worker. Shown in the dashboard and used for targeting containers to specific workers. Pick something descriptive like `mac-studio`, `build-server`, or `cloud-vm-1`. |
| `CONTAINER_IMAGE` | No | `localhost/claude-code-dev:latest` | The Podman image to use when creating dev containers. Must be available locally on the worker machine. |
| `PODMAN_PATH` | No | `podman` | Full path to the Podman binary. Only needed if `podman` is not in your system PATH (common on Windows). Example: `C:\Program Files\RedHat\Podman\podman.exe`. |

## Running

### Development mode (with hot reload)

```bash
cd apps/worker-agent

ORCHESTRATOR_URL=ws://localhost:3000/ws/worker \
WORKER_NAME=my-machine \
npm run dev
```

### Production mode

```bash
cd apps/worker-agent

ORCHESTRATOR_URL=ws://orchestrator.example.com:3000/ws/worker \
WORKER_NAME=prod-worker-1 \
npm run start
```

### Windows (PowerShell)

```powershell
cd apps\worker-agent

$env:ORCHESTRATOR_URL="ws://192.168.1.100:3000/ws/worker"
$env:WORKER_NAME="windows-worker"
# Only needed if podman is not in PATH:
$env:PODMAN_PATH="C:\Program Files\RedHat\Podman\podman.exe"
npm run dev
```

### Windows (Git Bash / MSYS2)

In Git Bash you must `export` variables — otherwise they are shell-local and the child process won't see them:

```bash
cd apps/worker-agent

export ORCHESTRATOR_URL=ws://192.168.1.100:3000/ws/worker
export WORKER_NAME=windows-worker
# Only needed if podman is not in PATH:
export PODMAN_PATH="C:/Program Files/RedHat/Podman/podman.exe"
npm run dev
```

Or as a one-liner:

```bash
ORCHESTRATOR_URL=ws://192.168.1.100:3000/ws/worker WORKER_NAME=windows-worker npm run dev
```

### Windows (Command Prompt)

```cmd
cd apps\worker-agent

set ORCHESTRATOR_URL=ws://192.168.1.100:3000/ws/worker
set WORKER_NAME=windows-worker
set PODMAN_PATH=C:\Program Files\RedHat\Podman\podman.exe
npm run dev
```

### Running as a systemd service

Create `/etc/systemd/system/code-farm-worker.service`:

```ini
[Unit]
Description=Code Farm Worker Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/code-farm/apps/worker-agent
Environment=ORCHESTRATOR_URL=ws://orchestrator-host:3000/ws/worker
Environment=WORKER_NAME=this-machine
Environment=CONTAINER_IMAGE=localhost/claude-code-dev:latest
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now code-farm-worker
sudo journalctl -u code-farm-worker -f
```

## Connection Behavior

### Registration

On startup, the agent:

1. Opens a WebSocket connection to `ORCHESTRATOR_URL`
2. Sends a `worker.register` message with system info (name, platform, CPU count, total memory)
3. Receives `worker.accepted` with an assigned worker ID
4. Starts the heartbeat loop

### Heartbeat

Every **10 seconds**, the agent sends a `worker.heartbeat` message with:

- **CPU usage** — percentage across all cores
- **Memory free** — bytes of free RAM
- **Containers running** — count of `claude-farm.managed` Podman containers

If the orchestrator doesn't receive a heartbeat within **30 seconds**, it marks the worker as offline.

### Reconnection

If the WebSocket connection drops, the agent automatically reconnects with exponential backoff:

- Starts at **1 second**
- Doubles each attempt up to **30 seconds** max
- Resets to 1 second on successful reconnect

The agent keeps running and retrying indefinitely — you don't need to restart it after network issues.

### Graceful Shutdown

On `SIGINT` (Ctrl+C) or `SIGTERM`:

1. Stops the heartbeat
2. Closes all active terminal sessions
3. Disconnects from the orchestrator
4. Exits cleanly

Running containers are **not** stopped on agent shutdown — they continue running in Podman and will be picked up when the agent reconnects.

## Command Handling

The agent handles these commands from the orchestrator:

| Command | Action |
|---------|--------|
| `container.create` | Runs `podman run -d` with `claude-farm.*` labels |
| `container.stop` | Runs `podman stop` + `podman rm -f` |
| `container.list` | Runs `podman ps --filter label=claude-farm.managed=true` |
| `terminal.open` | Spawns `podman exec -it <container> /bin/bash` |
| `terminal.input` | Writes data to terminal stdin |
| `terminal.resize` | Resizes the terminal (best-effort via `stty`) |
| `terminal.close` | Kills the terminal process |

## Container Naming

Containers are named: `cf-{sanitized-ticket-title}-{8-char-hex}`

Example: `cf-fix-auth-bug-a1b2c3d4`

## Troubleshooting

### Worker doesn't appear in dashboard

- Check that the `ORCHESTRATOR_URL` is reachable from the worker machine
- Look for connection errors in the agent logs
- Verify no firewall is blocking outbound WebSocket connections on the orchestrator port

### Container creation fails

- Verify the container image exists: `podman images localhost/claude-code-dev:latest`
- Check Podman is working: `podman run --rm alpine echo OK`
- Check the agent logs for Podman CLI errors

### Terminal not connecting

- Ensure the container is in `running` state: `podman ps`
- Check that `podman exec -it <container-id> /bin/bash` works manually
- Look for terminal-related errors in the agent logs
- **On Windows**: If you see `File not found` errors, set `PODMAN_PATH` to the full path to `podman.exe`

### High memory usage

- Each terminal session spawns a `podman exec` child process
- Many concurrent terminals = many processes
- Close unused terminal sessions from the web UI

## Logs

The agent logs to stdout/stderr with `[WorkerAgent]` prefix:

```
[WorkerAgent] Starting Code Farm Worker Agent
[WorkerAgent]   Name:          my-machine
[WorkerAgent]   Platform:      linux
[WorkerAgent]   CPUs:          8
[WorkerAgent]   Memory:        16.00 GB
[WorkerAgent]   Orchestrator:  ws://localhost:3000/ws/worker
[WorkerAgent]   Image:         localhost/claude-code-dev:latest
[WorkerAgent] Connecting to orchestrator...
[WorkerAgent] Connected to orchestrator
[WorkerAgent] Registered with worker ID: a1b2c3d4-...
[WorkerAgent] Heartbeat started (every 10s)
```
