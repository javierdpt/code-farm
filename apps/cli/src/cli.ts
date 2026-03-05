#!/usr/bin/env node

import { program } from "commander";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const require = createRequire(import.meta.url);

function resolvePackageDir(packageName: string): string {
  const pkgJson = require.resolve(`${packageName}/package.json`);
  return dirname(pkgJson);
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

function spawnPackage(
  packageName: string,
  entryPoint: string,
  label: string,
  color: string,
  extraEnv?: Record<string, string>
): ChildProcess {
  const pkgDir = resolvePackageDir(packageName);
  const script = join(pkgDir, entryPoint);

  const child = spawn("node", [script], {
    cwd: pkgDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1", ...extraEnv },
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
  .version(pkg.version);

program
  .command("start")
  .argument("[component]", "orchestrator, worker, or omit for both")
  .description("Start Code Farm components")
  .action((component?: string) => {
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
        spawnPackage(
          "@javierdpt/code-farm-orchestrator",
          "dist/server.js",
          "code-farm.orchestrator",
          PREFIX_COLORS.orchestrator,
          { NODE_ENV: "production" }
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
        spawnPackage(
          "@javierdpt/code-farm-worker-agent",
          "dist/index.js",
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

program.parse();
