import { WorkerInfo, WorkerStatus } from '@code-farm/shared';

class WorkerRegistry {
  private workers = new Map<string, WorkerInfo>();

  register(worker: WorkerInfo): void {
    this.workers.set(worker.id, worker);
  }

  unregister(workerId: string): void {
    this.workers.delete(workerId);
  }

  get(workerId: string): WorkerInfo | undefined {
    return this.workers.get(workerId);
  }

  getAll(): WorkerInfo[] {
    return Array.from(this.workers.values());
  }

  updateHeartbeat(
    workerId: string,
    stats: {
      cpuUsage?: number;
      memoryFree: number;
      diskTotal?: number;
      diskFree?: number;
      containersRunning: number;
    },
  ): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    if (stats.cpuUsage !== undefined) worker.cpuUsage = stats.cpuUsage;
    worker.memoryFree = stats.memoryFree;
    if (stats.diskTotal !== undefined) worker.diskTotal = stats.diskTotal;
    if (stats.diskFree !== undefined) worker.diskFree = stats.diskFree;
    worker.containersRunning = stats.containersRunning;
    worker.lastHeartbeat = new Date();
    worker.status = 'online';
  }

  findByName(name: string): WorkerInfo | undefined {
    for (const worker of this.workers.values()) {
      if (worker.name === name) {
        return worker;
      }
    }
    return undefined;
  }

  getLeastLoaded(): WorkerInfo | undefined {
    let best: WorkerInfo | undefined;
    for (const worker of this.workers.values()) {
      if (worker.status !== 'online') continue;
      if (!best || worker.containersRunning < best.containersRunning) {
        best = worker;
      }
    }
    return best;
  }
}

const g = globalThis as unknown as { __workerRegistry?: WorkerRegistry };
export const workerRegistry = g.__workerRegistry ?? (g.__workerRegistry = new WorkerRegistry());
