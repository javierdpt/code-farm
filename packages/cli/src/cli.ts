#!/usr/bin/env node

import { program } from "commander";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findMonorepoRoot(): string {
  let dir = __dirname;
  while (dir !== "/") {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
      if (pkg.name === "code-farm") return dir;
    } catch {
      // no package.json here, keep walking
    }
    dir = dirname(dir);
  }
  throw new Error(
    "Could not find code-farm monorepo root. Are you inside the repo?"
  );
}

const PREFIX_COLORS = {
  orchestrator: "\x1b[36m", // cyan
  worker: "\x1b[33m", // yellow
} as const;
const RESET = "\x1b[0m";

function prefixStream(
  stream: NodeJS.ReadableStream,
  label: string,
  color: string,
  target: NodeJS.WritableStream
) {
  let buffer = "";
  stream.setEncoding("utf-8");
  stream.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      target.write(`${color}[${label}]${RESET} ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer) {
      target.write(`${color}[${label}]${RESET} ${buffer}\n`);
    }
  });
}

function spawnComponent(
  root: string,
  workspace: string,
  label: string,
  color: string
): ChildProcess {
  const child = spawn("npm", ["run", "dev", "-w", workspace], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
    shell: true,
  });

  prefixStream(child.stdout!, label, color, process.stdout);
  prefixStream(child.stderr!, label, color, process.stderr);

  child.on("exit", (code) => {
    console.log(`${color}[${label}]${RESET} exited with code ${code}`);
  });

  return child;
}

program
  .name("code-farm-cli")
  .description("CLI for the Code Farm platform")
  .version("0.1.0");

program
  .command("start")
  .argument("[component]", "orchestrator, worker, or omit for both")
  .description("Start Code Farm components in dev mode")
  .action((component?: string) => {
    const root = findMonorepoRoot();
    const children: ChildProcess[] = [];

    const startOrchestrator = !component || component === "orchestrator";
    const startWorker = !component || component === "worker";

    if (
      component &&
      component !== "orchestrator" &&
      component !== "worker"
    ) {
      console.error(
        `Unknown component "${component}". Use "orchestrator", "worker", or omit for both.`
      );
      process.exit(1);
    }

    if (startOrchestrator) {
      children.push(
        spawnComponent(
          root,
          "apps/orchestrator",
          "code-farm.orchestrator",
          PREFIX_COLORS.orchestrator
        )
      );
    }

    if (startWorker) {
      if (!startOrchestrator && !process.env.ORCHESTRATOR_URL) {
        console.error(
          `${PREFIX_COLORS.worker}[code-farm.worker]${RESET} Error: ORCHESTRATOR_URL is not set.\n` +
          `\n` +
          `  The worker needs to know where the orchestrator is running.\n` +
          `  Set the ORCHESTRATOR_URL environment variable before starting:\n` +
          `\n` +
          `    ORCHESTRATOR_URL=ws://<orchestrator-ip>:3000/ws/worker code-farm-cli start worker\n`
        );
        process.exit(1);
      }

      children.push(
        spawnComponent(
          root,
          "apps/worker-agent",
          "code-farm.worker",
          PREFIX_COLORS.worker
        )
      );
    }

    const shutdown = () => {
      console.log("\nShutting down...");
      for (const child of children) {
        child.kill("SIGTERM");
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program
  .command("build")
  .description("Build all Code Farm packages and apps")
  .action(() => {
    const root = findMonorepoRoot();
    const child = spawn("npm", ["run", "build"], {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) => {
      process.exit(code ?? 1);
    });
  });

program.parse();
