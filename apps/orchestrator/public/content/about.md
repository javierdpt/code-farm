# About Code Farm

Code Farm is a self-hosted platform for orchestrating **agentic development containers** across multiple machines. It provides a centralized dashboard to launch, monitor, and interact with Claude Code instances running inside Podman containers on your worker machines.

## What It Does

- **Launch dev containers** from tickets — paste a GitHub issue or Azure DevOps work item URL, and Code Farm spins up a container with Claude Code ready to work on it
- **Manage multiple workers** — connect any number of machines running Podman as worker agents; they phone home to the orchestrator over WebSocket
- **Live terminal access** — open a web-based terminal (xterm.js) to any running container directly from the dashboard
- **Monitor resources** — see CPU, memory, and disk usage per container in real time
- **Build container images** — trigger and monitor image builds on your workers from the UI

## Purpose

The goal is to make **agentic AI development** practical at scale. Instead of manually SSH-ing into machines, starting containers, and copy-pasting context, Code Farm automates the entire workflow:

1. You provide a ticket URL
2. Code Farm picks a worker, creates a container, clones the repo, and starts Claude Code with the ticket context
3. You monitor progress and interact via the built-in terminal
4. When done, you review the results and clean up

This lets you run multiple Claude Code agents in parallel across different machines, all managed from a single browser tab.

## Architecture

Code Farm consists of three main components:

- **Orchestrator** — a Next.js web application with a WebSocket server that acts as the central hub. It serves the dashboard UI, manages worker connections, and proxies terminal sessions.
- **Worker Agent** — a lightweight Node.js process that runs on each machine with Podman installed. It connects outbound to the orchestrator (no port forwarding needed) and executes container operations locally.
- **Shared Package** — common TypeScript types, Zod schemas, and message factories used by both the orchestrator and worker agents.

Workers connect **outbound** to the orchestrator, so they work behind NAT and firewalls with zero configuration. All communication happens over WebSocket.

## Requirements

Each worker machine needs:

- **Podman** installed and configured (rootless or rootful)
- **Node.js 22+** to run the worker agent
- Network access to the orchestrator's WebSocket endpoint

The orchestrator itself just needs Node.js and can run on any machine accessible to your browser.

## Getting Started

For detailed installation and configuration instructions, see the [Setup Guide](/docs/setup).
