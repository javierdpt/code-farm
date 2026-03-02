import os from 'node:os';

export const config = {
  /** WebSocket URL for the orchestrator worker endpoint */
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000/ws/worker',

  /** Human-readable name for this worker */
  workerName: process.env.WORKER_NAME || os.hostname(),

  /** Operating system platform (linux, darwin, win32, etc.) */
  platform: os.platform(),

  /** Number of logical CPU cores */
  cpuCount: os.cpus().length,

  /** Total system memory in bytes */
  memoryTotal: os.totalmem(),

  /** Container image to use for new containers */
  containerImage: process.env.CONTAINER_IMAGE || 'localhost/claude-code-dev:latest',
};
