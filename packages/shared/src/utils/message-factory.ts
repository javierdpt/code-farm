import type {
  WorkerRegisterMessage,
  WorkerHeartbeatMessage,
  ContainerCreatedMessage,
  ContainerStartedMessage,
  ContainerStoppedMessage,
  ContainerRemovedMessage,
  ContainerListResponseMessage,
  ContainerListAllResponseMessage,
  TerminalOpenedMessage,
  TerminalOutputMessage,
  TerminalClosedMessage,
  WorkerAcceptedMessage,
  ContainerCreateMessage,
  ContainerStartMessage,
  ContainerStopMessage,
  ContainerRemoveMessage,
  ContainerListMessage,
  ContainerListAllMessage,
  TerminalOpenMessage,
  TerminalInputMessage,
  TerminalResizeMessage,
  TerminalCloseMessage,
  ImagesListMessage,
  ImagesListResponseMessage,
  ImageInfo,
  OpsLogMessage,
  ImageBuildMessage,
  ImageBuildOutputMessage,
  ImageBuildDoneMessage,
  ImageBuildErrorMessage,
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

export function createContainerStarted(
  requestId: string,
  container: ContainerInfo,
): ContainerStartedMessage {
  return {
    type: 'container.started',
    requestId,
    container,
  };
}

export function createContainerStopped(
  requestId: string,
  containerId: string,
  container?: ContainerInfo,
): ContainerStoppedMessage {
  return {
    type: 'container.stopped',
    requestId,
    containerId,
    ...(container ? { container } : {}),
  };
}

export function createContainerRemoved(
  requestId: string,
  containerId: string,
): ContainerRemovedMessage {
  return {
    type: 'container.removed',
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

export function createOpsLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  command?: string,
): OpsLogMessage {
  return {
    type: 'ops.log',
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(command ? { command } : {}),
  };
}

export function createImageBuildOutput(
  requestId: string,
  data: string,
): ImageBuildOutputMessage {
  return {
    type: 'image.build.output',
    requestId,
    data,
  };
}

export function createImageBuildDone(
  requestId: string,
  imageId: string,
  tag: string,
): ImageBuildDoneMessage {
  return {
    type: 'image.build.done',
    requestId,
    imageId,
    tag,
  };
}

export function createImageBuildError(
  requestId: string,
  error: string,
): ImageBuildErrorMessage {
  return {
    type: 'image.build.error',
    requestId,
    error,
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

export function createContainerStart(
  requestId: string,
  containerId: string,
): ContainerStartMessage {
  return {
    type: 'container.start',
    requestId,
    containerId,
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

export function createContainerRemove(
  requestId: string,
  containerId: string,
): ContainerRemoveMessage {
  return {
    type: 'container.remove',
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

export function createContainerListAll(
  requestId: string,
): ContainerListAllMessage {
  return {
    type: 'container.list-all',
    requestId,
  };
}

export function createContainerListAllResponse(
  requestId: string,
  containers: ContainerInfo[],
): ContainerListAllResponseMessage {
  return {
    type: 'container.list-all.response',
    requestId,
    containers,
  };
}

export function createImageBuild(
  requestId: string,
  dockerfile: string,
  tag: string,
): ImageBuildMessage {
  return {
    type: 'image.build',
    requestId,
    dockerfile,
    tag,
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

export function createImagesList(
  requestId: string,
): ImagesListMessage {
  return {
    type: 'images.list',
    requestId,
  };
}

export function createImagesListResponse(
  requestId: string,
  images: ImageInfo[],
): ImagesListResponseMessage {
  return {
    type: 'images.list.response',
    requestId,
    images,
  };
}
