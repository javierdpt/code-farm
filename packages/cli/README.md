# @javierdpt/code-farm-cli

> **TL;DR** — CLI to start Code Farm components. Install from GitHub Packages or from source.

## Install from GitHub Packages

One-time registry setup:

```bash
# Configure npm to use GitHub Packages for @javierdpt scope
echo "@javierdpt:registry=https://npm.pkg.github.com" >> ~/.npmrc

# Authenticate (reuse your gh CLI token, or use a PAT with read:packages scope)
echo "//npm.pkg.github.com/:_authToken=$(gh auth token)" >> ~/.npmrc
```

Or as a single command:

```bash
printf "@javierdpt:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=$(gh auth token)\n" >> ~/.npmrc
```

Then install:

```bash
npm install -g @javierdpt/code-farm-cli
```

## Install from Source

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

> **Note:** The worker defaults to `ws://localhost:3000/ws/worker` when no `ORCHESTRATOR_URL` is set. For remote workers:
>
> ```bash
> ORCHESTRATOR_URL=ws://<orchestrator-ip>:3000/ws/worker code-farm-cli start worker
> ```

## Publishing

The CLI is automatically published to GitHub Packages via GitHub Actions.

- **Auto**: Any push to `main` that changes `packages/cli/**` bumps the **patch** version and publishes
- **Manual**: Go to Actions > "Publish CLI" > "Run workflow" > choose **patch**, **minor**, or **major**

Version bump commits are tagged `[skip ci]` to prevent infinite loops.
