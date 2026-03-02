// Shared state accessible from both server.ts WS handlers and Next.js route handlers
import { WebSocket } from 'ws';
import { ContainerInfo } from '@code-farm/shared';

class WSState {
  workerSockets = new Map<string, WebSocket>();
  containers = new Map<string, ContainerInfo>();
  pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: NodeJS.Timeout }
  >();

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
}

const g = globalThis as unknown as { __wsState?: WSState };
export const wsState = g.__wsState ?? (g.__wsState = new WSState());
