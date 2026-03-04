#!/usr/bin/env node
import { config } from './config.js';
import { WorkerWSClient } from './ws-client.js';
import { HeartbeatReporter } from './heartbeat.js';
import { ContainerManager } from './container-manager.js';
import { TerminalManager } from './terminal-manager.js';
import { setupRepo } from './repo-setup.js';
import type {
  OrchestratorMessage,
  WorkerRegisterMessage,
  WorkerHeartbeatMessage,
  ContainerCreatedMessage,
  ContainerStartedMessage,
  ContainerStoppedMessage,
  ContainerRemovedMessage,
  ContainerListResponseMessage,
  ContainerListAllResponseMessage,
  ImagesListResponseMessage,
  TerminalOpenedMessage,
  TerminalOutputMessage,
  TerminalClosedMessage,
  WorkerMessage,
} from '@javierdpt/code-farm-shared';
import {
  OrchestratorMessageSchema,
  createOpsLog,
  createImageBuildOutput,
  createImageBuildDone,
  createImageBuildError,
} from '@javierdpt/code-farm-shared';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let workerId: string | null = null;

const containerManager = new ContainerManager();
const terminalManager = new TerminalManager();

// Wire up ops log callback to send ops.log messages to orchestrator
containerManager.setOpsLogCallback((level, message, command) => {
  wsClient.send(createOpsLog(level, message, command));
});

// ---------------------------------------------------------------------------
// WebSocket Client
// ---------------------------------------------------------------------------

const wsClient = new WorkerWSClient(config.orchestratorUrl, {
  onOpen() {
    console.log('[WorkerAgent] Connected - sending registration');

    const registerMsg: WorkerRegisterMessage = {
      type: 'worker.register',
      name: config.workerName,
      hostname: config.workerName,
      platform: config.platform,
      cpuCount: config.cpuCount,
      memoryTotal: config.memoryTotal,
    };

    wsClient.send(registerMsg);
  },

  onMessage(raw: unknown) {
    handleMessage(raw).catch((err) => {
      console.error('[WorkerAgent] Error handling message:', err);
    });
  },

  onClose(_code, _reason) {
    // HeartbeatReporter will keep running; it just won't be able to send
    // until reconnection succeeds.
  },

  onError(_err) {
    // Logged by ws-client; nothing additional needed here
  },
});

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

const heartbeat = new HeartbeatReporter(
  (msg: WorkerHeartbeatMessage) => wsClient.send(msg),
  () => containerManager.runningCount(),
);

// ---------------------------------------------------------------------------
// Message Handler
// ---------------------------------------------------------------------------

async function handleMessage(raw: unknown): Promise<void> {
  // Validate incoming message against the schema
  const parseResult = OrchestratorMessageSchema.safeParse(raw);
  if (!parseResult.success) {
    console.warn('[WorkerAgent] Received invalid message:', parseResult.error.message);
    return;
  }

  const msg: OrchestratorMessage = parseResult.data;

  switch (msg.type) {
    // -- Registration accepted ---
    case 'worker.accepted': {
      workerId = msg.workerId;
      containerManager.setWorkerId(workerId);
      console.log(`[WorkerAgent] Registration accepted (workerId=${workerId})`);
      heartbeat.start();
      break;
    }

    // -- Container operations ---
    case 'container.create': {
      try {
        const info = await containerManager.create(msg.config);

        // Set up the repository inside the container if repoUrl is provided
        if (msg.config.repoUrl) {
          try {
            const result = await setupRepo(
              containerManager,
              info.id,
              msg.config.repoUrl,
              msg.config.branch,
              msg.config.claudeMd,
              msg.config.gitToken,
            );
            if (!result.cloned) {
              containerManager['emitOpsLog']('warn', result.error || 'Repo clone failed', `git clone ${msg.config.repoUrl}`);
            } else {
              containerManager['emitOpsLog']('info', `Repo cloned via ${result.method}`, `git clone ${msg.config.repoUrl}`);
            }
          } catch (repoErr) {
            console.error(
              '[WorkerAgent] Repo setup failed (container still running):',
              repoErr,
            );
            containerManager['emitOpsLog']('error', `Repo setup failed: ${(repoErr as Error).message}`, `git clone ${msg.config.repoUrl}`);
          }
        }

        // Fetch stats for newly created container (best-effort)
        const detailed = await containerManager.inspectWithStats(info.id);

        const response: ContainerCreatedMessage = {
          type: 'container.created',
          requestId: msg.requestId,
          container: detailed,
        };
        wsClient.send(response);
      } catch (err) {
        console.error('[WorkerAgent] container.create failed:', err);
        wsClient.send({
          type: 'container.create.error',
          requestId: msg.requestId,
          error: (err as Error).message,
        });
      }
      break;
    }

    case 'container.start': {
      try {
        await containerManager.start(msg.containerId);
        // Fetch with stats now that it's running
        const info = await containerManager.inspectWithStats(msg.containerId);
        const response: ContainerStartedMessage = {
          type: 'container.started',
          requestId: msg.requestId,
          container: info,
        };
        wsClient.send(response);
      } catch (err) {
        console.error('[WorkerAgent] container.start failed:', err);
        wsClient.send({
          type: 'container.start.error',
          requestId: msg.requestId,
          containerId: msg.containerId,
          error: (err as Error).message,
        });
      }
      break;
    }

    case 'container.stop': {
      try {
        const info = await containerManager.stop(msg.containerId);
        const response: ContainerStoppedMessage = {
          type: 'container.stopped',
          requestId: msg.requestId,
          containerId: msg.containerId,
          container: info,
        };
        wsClient.send(response);
      } catch (err) {
        console.error('[WorkerAgent] container.stop failed:', err);
        wsClient.send({
          type: 'container.stop.error',
          requestId: msg.requestId,
          containerId: msg.containerId,
          error: (err as Error).message,
        });
      }
      break;
    }

    case 'container.remove': {
      try {
        await containerManager.remove(msg.containerId);
        const response: ContainerRemovedMessage = {
          type: 'container.removed',
          requestId: msg.requestId,
          containerId: msg.containerId,
        };
        wsClient.send(response);
      } catch (err) {
        console.error('[WorkerAgent] container.remove failed:', err);
        wsClient.send({
          type: 'container.remove.error',
          requestId: msg.requestId,
          containerId: msg.containerId,
          error: (err as Error).message,
        });
      }
      break;
    }

    case 'container.list': {
      try {
        const containers = await containerManager.list();
        const response: ContainerListResponseMessage = {
          type: 'container.list.response',
          requestId: msg.requestId,
          containers,
        };
        wsClient.send(response);
      } catch (err) {
        console.error('[WorkerAgent] container.list failed:', err);
        wsClient.send({
          type: 'container.list.error',
          requestId: msg.requestId,
          error: (err as Error).message,
        });
      }
      break;
    }

    case 'container.list-all': {
      try {
        const containers = await containerManager.listAll();
        const response: ContainerListAllResponseMessage = {
          type: 'container.list-all.response',
          requestId: msg.requestId,
          containers,
        };
        wsClient.send(response);
      } catch (err) {
        console.error('[WorkerAgent] container.list-all failed:', err);
        wsClient.send({
          type: 'container.list-all.error',
          requestId: msg.requestId,
          error: (err as Error).message,
        });
      }
      break;
    }

    case 'images.list': {
      try {
        const images = await containerManager.listImages();
        const response: ImagesListResponseMessage = {
          type: 'images.list.response',
          requestId: msg.requestId,
          images,
        };
        wsClient.send(response);
      } catch (err) {
        console.error('[WorkerAgent] images.list failed:', err);
        wsClient.send({
          type: 'images.list.error',
          requestId: msg.requestId,
          error: (err as Error).message,
        });
      }
      break;
    }

    // -- Image build ---
    case 'image.build': {
      const { requestId, dockerfile, tag } = msg;
      containerManager.buildImage(
        dockerfile,
        tag,
        (data) => wsClient.send(createImageBuildOutput(requestId, data)),
        (imageId) => wsClient.send(createImageBuildDone(requestId, imageId, tag)),
        (error) => wsClient.send(createImageBuildError(requestId, error)),
      );
      break;
    }

    // -- Terminal operations ---
    case 'terminal.open': {
      try {
        const sessionId = terminalManager.open(
          msg.containerId,
          msg.cols,
          msg.rows,
          (data: Buffer) => {
            const output: TerminalOutputMessage = {
              type: 'terminal.output',
              sessionId,
              data: data.toString('base64'),
            };
            wsClient.send(output);
          },
          (exitCode: number | null) => {
            const closed: TerminalClosedMessage = {
              type: 'terminal.closed',
              sessionId,
              exitCode: exitCode ?? undefined,
            };
            wsClient.send(closed);
          },
        );

        const response: TerminalOpenedMessage = {
          type: 'terminal.opened',
          requestId: msg.requestId,
          sessionId,
        };
        wsClient.send(response);
      } catch (err) {
        console.error('[WorkerAgent] terminal.open failed:', err);
        wsClient.send({
          type: 'terminal.open.error',
          requestId: msg.requestId,
          containerId: msg.containerId,
          error: (err as Error).message,
        });
      }
      break;
    }

    case 'terminal.input': {
      terminalManager.write(msg.sessionId, Buffer.from(msg.data, 'base64'));
      break;
    }

    case 'terminal.resize': {
      terminalManager.resize(msg.sessionId, msg.cols, msg.rows);
      break;
    }

    case 'terminal.close': {
      terminalManager.close(msg.sessionId);
      break;
    }

    default: {
      // TypeScript exhaustiveness check - should never reach here
      const _exhaustive: never = msg;
      console.warn(`[WorkerAgent] Unhandled message type: ${(_exhaustive as { type: string }).type}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[WorkerAgent] Received ${signal}, shutting down...`);

  heartbeat.stop();
  terminalManager.closeAll();
  wsClient.disconnect();

  // Give a moment for cleanup messages to flush
  await new Promise((resolve) => setTimeout(resolve, 500));
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

console.log('============================================================');
console.log('              Code-Farm Worker Agent                         ');
console.log('============================================================');
console.log(`  Worker Name:     ${config.workerName}`);
console.log(`  Platform:        ${config.platform}`);
console.log(`  CPUs:            ${config.cpuCount}`);
console.log(`  Memory:          ${(config.memoryTotal / 1024 / 1024 / 1024).toFixed(1)} GB`);
console.log(`  Orchestrator:    ${config.orchestratorUrl}`);
console.log('============================================================');
console.log('');

wsClient.connect();
