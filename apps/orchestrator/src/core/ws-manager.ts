import { Server as HttpServer } from 'http';
import { parse } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  parseWorkerMessage,
  generateRequestId,
  createWorkerAccepted,
  createContainerListAll,
  createTerminalOpen,
  createTerminalInput,
  createTerminalResize,
  createTerminalClose,
  WS_PATHS,
} from '@code-farm/shared';
import type { WorkerMessage } from '@code-farm/shared';
import { workerRegistry } from './worker-registry.js';
import { terminalRelay } from './terminal-relay.js';
import { wsState } from './ws-state.js';

function handleWorkerMessage(workerId: string, message: WorkerMessage): void {
  switch (message.type) {
    case 'worker.heartbeat': {
      workerRegistry.updateHeartbeat(workerId, {
        cpuUsage: message.cpuUsage,
        memoryFree: message.memoryFree,
        diskTotal: message.diskTotal,
        diskFree: message.diskFree,
        containersRunning: message.containersRunning,
      });
      break;
    }

    case 'container.created': {
      // Store container in shared state, ensuring workerId matches current connection
      wsState.containers.set(message.container.id, { ...message.container, workerId });
      wsState.resolveRequest(message.requestId, message.container);
      break;
    }

    case 'container.started': {
      // Update container in shared state with running status
      wsState.containers.set(message.container.id, { ...message.container, workerId });
      wsState.resolveRequest(message.requestId, message.container);
      break;
    }

    case 'container.stopped': {
      // Update container status (keep it in state, don't delete)
      if (message.container) {
        wsState.containers.set(message.containerId, { ...message.container, workerId });
      } else {
        const existing = wsState.containers.get(message.containerId);
        if (existing) {
          wsState.containers.set(message.containerId, { ...existing, status: 'stopped' });
        }
      }
      wsState.resolveRequest(message.requestId, { containerId: message.containerId });
      break;
    }

    case 'container.removed': {
      // Remove container from shared state permanently
      wsState.containers.delete(message.containerId);
      wsState.resolveRequest(message.requestId, { containerId: message.containerId });
      break;
    }

    case 'container.list.response': {
      // Update container state, ensuring workerId matches the current connection
      for (const container of message.containers) {
        wsState.containers.set(container.id, { ...container, workerId });
      }
      // Resolve pending request
      wsState.resolveRequest(message.requestId, message.containers);
      break;
    }

    case 'container.list-all.response': {
      // Build set of current container IDs from this worker
      const currentIds = new Set(message.containers.map(c => c.id));
      // Remove stale containers: any container whose workerId matches the current
      // connection OR whose ID is in the incoming list (handles workerId changes on reconnect)
      for (const [id, container] of wsState.containers) {
        if (container.workerId === workerId && !currentIds.has(id)) {
          wsState.containers.delete(id);
        }
      }
      // Update/add containers, ensuring workerId matches the current connection
      for (const container of message.containers) {
        wsState.containers.set(container.id, { ...container, workerId });
      }
      // Resolve pending request
      wsState.resolveRequest(message.requestId, message.containers);
      break;
    }

    case 'images.list.response': {
      wsState.resolveRequest(message.requestId, message.images);
      break;
    }

    case 'terminal.opened': {
      // Resolve pending request with the sessionId
      wsState.resolveRequest(message.requestId, { sessionId: message.sessionId });
      break;
    }

    case 'terminal.output': {
      // Relay terminal output to the browser
      const bridge = terminalRelay.getBridgeBySession(message.sessionId);
      if (bridge && bridge.browserWs.readyState === WebSocket.OPEN) {
        bridge.browserWs.send(JSON.stringify({
          type: 'terminal.output',
          data: message.data,
        }));
      }
      break;
    }

    case 'terminal.closed': {
      // Notify the browser that the terminal session closed
      const closeBridge = terminalRelay.getBridgeBySession(message.sessionId);
      if (closeBridge && closeBridge.browserWs.readyState === WebSocket.OPEN) {
        closeBridge.browserWs.send(JSON.stringify({
          type: 'terminal.closed',
          exitCode: message.exitCode,
        }));
      }
      break;
    }

    case 'ops.log': {
      wsState.addOpsLog({
        timestamp: message.timestamp,
        level: message.level,
        message: message.message,
        command: message.command,
        workerId,
        workerName: workerRegistry.get(workerId)?.name,
      });
      break;
    }

    case 'image.build.output': {
      wsState.appendBuildOutput(message.requestId, message.data);
      break;
    }

    case 'image.build.done': {
      wsState.completeBuild(message.requestId, message.imageId, message.tag);
      break;
    }

    case 'image.build.error': {
      wsState.failBuild(message.requestId, message.error);
      break;
    }

    case 'worker.register': {
      // Should not happen after initial registration, ignore
      console.warn(`[WSManager] Unexpected worker.register from already-registered worker ${workerId}`);
      break;
    }

    // Error responses from worker
    case 'container.create.error':
    case 'container.start.error':
    case 'container.stop.error':
    case 'container.remove.error':
    case 'container.list.error':
    case 'container.list-all.error':
    case 'terminal.open.error':
    case 'images.list.error': {
      console.error(`[WSManager] Worker error (${message.type}): ${message.error}`);
      wsState.rejectRequest(message.requestId, message.error);
      break;
    }
  }
}

/** Periodically sync container state from all connected workers. */
function startContainerSync() {
  const SYNC_INTERVAL = 10_000; // 10 seconds
  setInterval(() => {
    for (const [workerId, ws] of wsState.workerSockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const requestId = generateRequestId();
      const msg = createContainerListAll(requestId);
      // Fire-and-forget: response handled by handleWorkerMessage
      wsState.pendingRequests.set(requestId, {
        resolve: () => {},
        reject: () => {},
        timer: setTimeout(() => {
          wsState.pendingRequests.delete(requestId);
        }, 15000),
      });
      ws.send(JSON.stringify(msg));
    }
  }, SYNC_INTERVAL);
}

export function setupWebSocketServer(server: HttpServer) {
  const workerWss = new WebSocketServer({ noServer: true });
  const terminalWss = new WebSocketServer({ noServer: true });

  // Start periodic container state sync
  startContainerSync();

  // Handle HTTP upgrade to WebSocket
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '', true);

    if (pathname === WS_PATHS.WORKER) {
      workerWss.handleUpgrade(request, socket, head, (ws) => {
        workerWss.emit('connection', ws, request);
      });
    } else if (pathname === WS_PATHS.TERMINAL) {
      terminalWss.handleUpgrade(request, socket, head, (ws) => {
        terminalWss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Worker WebSocket connection handler
  workerWss.on('connection', (ws: WebSocket) => {
    let workerId: string | null = null;

    ws.on('message', (rawData) => {
      let data: unknown;
      try {
        data = JSON.parse(rawData.toString());
      } catch {
        console.error('[WSManager] Invalid JSON from worker');
        return;
      }

      // First message must be worker.register
      if (!workerId) {
        let message: WorkerMessage;
        try {
          message = parseWorkerMessage(data);
        } catch (err) {
          console.error('[WSManager] Invalid first message from worker:', err);
          ws.close(1008, 'Invalid registration message');
          return;
        }

        if (message.type !== 'worker.register') {
          console.error('[WSManager] First message must be worker.register');
          ws.close(1008, 'Expected worker.register');
          return;
        }

        workerId = crypto.randomUUID();
        const now = new Date();

        workerRegistry.register({
          id: workerId,
          name: message.name,
          status: 'online',
          hostname: message.hostname,
          platform: message.platform,
          cpuCount: message.cpuCount,
          memoryTotal: message.memoryTotal,
          memoryFree: 0,
          containersRunning: 0,
          lastHeartbeat: now,
          connectedAt: now,
        });

        wsState.workerSockets.set(workerId, ws);

        const accepted = createWorkerAccepted(workerId);
        ws.send(JSON.stringify(accepted));

        console.log(`[WSManager] Worker registered: ${message.name} (${workerId})`);

        // Request all containers from the newly connected worker
        const listAllRequestId = generateRequestId();
        const listAllMsg = createContainerListAll(listAllRequestId);
        ws.send(JSON.stringify(listAllMsg));

        return;
      }

      // Subsequent messages
      let message: WorkerMessage;
      try {
        message = parseWorkerMessage(data);
      } catch (err) {
        console.error(`[WSManager] Invalid message from worker ${workerId}:`, err);
        return;
      }

      handleWorkerMessage(workerId, message);
    });

    ws.on('close', () => {
      if (workerId) {
        console.log(`[WSManager] Worker disconnected: ${workerId}`);
        workerRegistry.unregister(workerId);
        wsState.workerSockets.delete(workerId);

        // Clean up containers belonging to this worker
        for (const [containerId, container] of wsState.containers) {
          if (container.workerId === workerId) {
            wsState.containers.delete(containerId);
          }
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[WSManager] Worker WebSocket error (${workerId}):`, err);
    });
  });

  // Terminal WebSocket connection handler
  terminalWss.on('connection', (ws: WebSocket, request) => {
    const { query } = parse(request.url || '', true);
    const containerId = query.containerId as string | undefined;
    const workerId = query.workerId as string | undefined;

    if (!containerId || !workerId) {
      ws.close(1008, 'Missing containerId or workerId query parameters');
      return;
    }

    const workerWs = wsState.workerSockets.get(workerId);
    if (!workerWs || workerWs.readyState !== WebSocket.OPEN) {
      ws.close(1011, 'Worker not connected');
      return;
    }

    // Create a terminal bridge
    const tempKey = terminalRelay.addBridge(ws, workerId, containerId);

    // Parse optional cols/rows from query
    const cols = parseInt(query.cols as string, 10) || 80;
    const rows = parseInt(query.rows as string, 10) || 24;

    // Send terminal.open to worker
    const requestId = generateRequestId();
    const openMsg = createTerminalOpen(requestId, containerId, cols, rows);
    wsState.sendToWorker(workerId, openMsg);

    // Wait for terminal.opened response to get the sessionId
    wsState.pendingRequests.set(requestId, {
      resolve: (result: unknown) => {
        const { sessionId } = result as { sessionId: string };
        terminalRelay.setSessionId(ws, sessionId);

        // Notify browser that terminal is ready
        ws.send(JSON.stringify({
          type: 'terminal.opened',
          sessionId,
        }));
      },
      reject: (err: Error) => {
        console.error('[WSManager] Failed to open terminal:', err);
        ws.close(1011, 'Failed to open terminal session');
      },
      timer: setTimeout(() => {
        wsState.pendingRequests.delete(requestId);
        ws.close(1011, 'Terminal open timed out');
      }, 30000),
    });

    // Handle messages from browser
    ws.on('message', (rawData) => {
      const bridge = terminalRelay.getBridgeByBrowser(ws);
      if (!bridge || !bridge.sessionId) return;

      // Check if data is plain text (terminal input) or JSON (control message)
      const dataStr = rawData.toString();
      let parsed: { type?: string; cols?: number; rows?: number; data?: string } | undefined;
      try {
        parsed = JSON.parse(dataStr);
      } catch {
        // Not JSON - treat as raw terminal input (base64 encode it)
        const inputMsg = createTerminalInput(
          bridge.sessionId,
          Buffer.from(dataStr).toString('base64'),
        );
        wsState.sendToWorker(bridge.workerId, inputMsg);
        return;
      }

      if (parsed && parsed.type === 'terminal.browser.resize') {
        const resizeMsg = createTerminalResize(
          bridge.sessionId,
          parsed.cols || 80,
          parsed.rows || 24,
        );
        wsState.sendToWorker(bridge.workerId, resizeMsg);
      } else if (parsed && parsed.type === 'terminal.input' && parsed.data) {
        // Browser may send structured input messages too
        const inputMsg = createTerminalInput(bridge.sessionId, parsed.data);
        wsState.sendToWorker(bridge.workerId, inputMsg);
      }
    });

    // Handle browser disconnect
    ws.on('close', () => {
      const bridge = terminalRelay.getBridgeByBrowser(ws);
      if (bridge && bridge.sessionId) {
        // Tell worker to close the terminal
        const closeMsg = createTerminalClose(bridge.sessionId);
        wsState.sendToWorker(bridge.workerId, closeMsg);
      }
      terminalRelay.removeBridge(ws);
    });

    ws.on('error', (err) => {
      console.error('[WSManager] Terminal WebSocket error:', err);
    });
  });

  return { workerWss, terminalWss };
}

export function getWorkerSocket(workerId: string): WebSocket | undefined {
  return wsState.workerSockets.get(workerId);
}

export function sendToWorker(workerId: string, message: object): void {
  wsState.sendToWorker(workerId, message);
}
