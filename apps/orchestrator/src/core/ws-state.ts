// Shared state accessible from both server.ts WS handlers and Next.js route handlers
import { WebSocket } from 'ws';
import { ContainerInfo } from '@code-farm/shared';

export interface OpsLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  command?: string;
  workerId: string;
  workerName?: string;
}

interface BuildBuffer {
  lines: string[];
  done: boolean;
  error?: string;
  result?: { imageId: string; tag: string };
  listeners: Set<(event: string) => void>;
}

class WSState {
  workerSockets = new Map<string, WebSocket>();
  containers = new Map<string, ContainerInfo>();
  buildBuffers = new Map<string, BuildBuffer>();
  pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: NodeJS.Timeout }
  >();

  // Operations log circular buffer
  opsLogs: OpsLogEntry[] = [];
  private opsLogListeners: Set<(entry: OpsLogEntry) => void> = new Set();
  private readonly MAX_OPS_LOGS = 500;

  addOpsLog(entry: OpsLogEntry): void {
    this.opsLogs.push(entry);
    if (this.opsLogs.length > this.MAX_OPS_LOGS) {
      this.opsLogs = this.opsLogs.slice(-this.MAX_OPS_LOGS);
    }
    this.opsLogListeners.forEach(cb => cb(entry));
  }

  onOpsLog(cb: (entry: OpsLogEntry) => void): () => void {
    this.opsLogListeners.add(cb);
    return () => { this.opsLogListeners.delete(cb); };
  }

  sendToWorker(workerId: string, message: object): void {
    const ws = this.workerSockets.get(workerId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error(`[WSState] Worker ${workerId} not connected or socket not open`);
      return;
    }
    ws.send(JSON.stringify(message));
  }

  sendRequest(
    workerId: string,
    message: object & { requestId: string },
    timeoutMs = 30000,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const ws = this.workerSockets.get(workerId);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error(`Worker ${workerId} not connected`));
        return;
      }
      const timer = setTimeout(() => {
        this.pendingRequests.delete(message.requestId);
        reject(new Error('Request timed out'));
      }, timeoutMs);
      this.pendingRequests.set(message.requestId, { resolve, reject, timer });
      this.sendToWorker(workerId, message);
    });
  }

  resolveRequest(requestId: string, data: unknown): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(requestId);
      pending.resolve(data);
    }
  }

  rejectRequest(requestId: string, error: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(requestId);
      pending.reject(new Error(error));
    }
  }

  getBuildBuffer(requestId: string): BuildBuffer {
    if (!this.buildBuffers.has(requestId)) {
      this.buildBuffers.set(requestId, { lines: [], done: false, listeners: new Set() });
    }
    return this.buildBuffers.get(requestId)!;
  }

  appendBuildOutput(requestId: string, data: string): void {
    const buf = this.getBuildBuffer(requestId);
    buf.lines.push(data);
    buf.listeners.forEach(cb => cb(`data: ${JSON.stringify({ type: 'output', data })}\n\n`));
  }

  completeBuild(requestId: string, imageId: string, tag: string): void {
    const buf = this.getBuildBuffer(requestId);
    buf.done = true;
    buf.result = { imageId, tag };
    buf.listeners.forEach(cb => {
      cb(`data: ${JSON.stringify({ type: 'done', imageId, tag })}\n\n`);
    });
    this.resolveRequest(requestId, { imageId, tag });
  }

  failBuild(requestId: string, error: string): void {
    const buf = this.getBuildBuffer(requestId);
    buf.done = true;
    buf.error = error;
    buf.listeners.forEach(cb => {
      cb(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
    });
    this.rejectRequest(requestId, error);
  }
}

const g = globalThis as unknown as { __wsState?: WSState };
export const wsState = g.__wsState ?? (g.__wsState = new WSState());

export function getWSState(): WSState {
  return wsState;
}
