import type {
  WorkerRegisterMessage,
  WorkerHeartbeatMessage,
  ContainerCreatedMessage,
  ContainerStoppedMessage,
  ContainerListResponseMessage,
  TerminalOpenedMessage,
  TerminalOutputMessage,
  TerminalClosedMessage,
  WorkerAcceptedMessage,
  ContainerCreateMessage,
  ContainerStopMessage,
  ContainerListMessage,
  TerminalOpenMessage,
  TerminalInputMessage,
  TerminalResizeMessage,
  TerminalCloseMessage,
} from '../types/messages.js';
import type { ContainerCreateRequest, ContainerInfo } from '../types/container.js';

// ============================================================
// Request ID generation
// ============================================================

export function generateRequestId(): string {
  return crypto.randomUUID();
}

// ============================================================
// Worker-to-Orchestrator message factories
// ============================================================

export function createWorkerRegister(info: {
  name: string;
  hostname: string;
  platform: string;
  cpuCount: number;
  memoryTotal: number;
}): WorkerRegisterMessage {
  return {
    type: 'worker.register',
    ...info,
  };
}

export function createHeartbeat(stats: {
  cpuUsage: number;
  memoryFree: number;
  containersRunning: number;
}): WorkerHeartbeatMessage {
  return {
    type: 'worker.heartbeat',
    ...stats,
  };
}

export function createContainerCreated(
  requestId: string,
  container: ContainerInfo,
): ContainerCreatedMessage {
  return {
    type: 'container.created',
    requestId,
    container,
  };
}

export function createContainerStopped(
  requestId: string,
  containerId: string,
): ContainerStoppedMessage {
  return {
    type: 'container.stopped',
    requestId,
    containerId,
  };
}

export function createContainerListResponse(
  requestId: string,
  containers: ContainerInfo[],
): ContainerListResponseMessage {
  return {
    type: 'container.list.response',
    requestId,
    containers,
  };
}

export function createTerminalOpened(
  requestId: string,
  sessionId: string,
): TerminalOpenedMessage {
  return {
    type: 'terminal.opened',
    requestId,
    sessionId,
  };
}

export function createTerminalOutput(
  sessionId: string,
  data: string,
): TerminalOutputMessage {
  return {
    type: 'terminal.output',
    sessionId,
    data,
  };
}

export function createTerminalClosed(
  sessionId: string,
  exitCode?: number,
): TerminalClosedMessage {
  return {
    type: 'terminal.closed',
    sessionId,
    ...(exitCode !== undefined ? { exitCode } : {}),
  };
}

// ============================================================
// Orchestrator-to-Worker message factories
// ============================================================

export function createWorkerAccepted(
  workerId: string,
): WorkerAcceptedMessage {
  return {
    type: 'worker.accepted',
    workerId,
  };
}

export function createContainerCreate(
  requestId: string,
  config: ContainerCreateRequest,
): ContainerCreateMessage {
  return {
    type: 'container.create',
    requestId,
    config,
  };
}

export function createContainerStop(
  requestId: string,
  containerId: string,
): ContainerStopMessage {
  return {
    type: 'container.stop',
    requestId,
    containerId,
  };
}

export function createContainerList(
  requestId: string,
): ContainerListMessage {
  return {
    type: 'container.list',
    requestId,
  };
}

export function createTerminalOpen(
  requestId: string,
  containerId: string,
  cols: number,
  rows: number,
): TerminalOpenMessage {
  return {
    type: 'terminal.open',
    requestId,
    containerId,
    cols,
    rows,
  };
}

export function createTerminalInput(
  sessionId: string,
  data: string,
): TerminalInputMessage {
  return {
    type: 'terminal.input',
    sessionId,
    data,
  };
}

export function createTerminalResize(
  sessionId: string,
  cols: number,
  rows: number,
): TerminalResizeMessage {
  return {
    type: 'terminal.resize',
    sessionId,
    cols,
    rows,
  };
}

export function createTerminalClose(
  sessionId: string,
): TerminalCloseMessage {
  return {
    type: 'terminal.close',
    sessionId,
  };
}
