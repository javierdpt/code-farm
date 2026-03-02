import os from 'node:os';
import fs from 'node:fs';
import { HEARTBEAT_INTERVAL } from '@code-farm/shared';
import type { WorkerHeartbeatMessage } from '@code-farm/shared';

interface CpuSnapshot {
  idle: number;
  total: number;
}

/**
 * Periodically sends system-level heartbeat messages to the orchestrator
 * so it can track worker health and resource availability.
 */
export class HeartbeatReporter {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private previousCpuSnapshot: CpuSnapshot | null = null;
  private readonly sendFn: (message: WorkerHeartbeatMessage) => void;
  private readonly getContainerCount: () => Promise<number>;

  constructor(
    sendFn: (message: WorkerHeartbeatMessage) => void,
    getContainerCount: () => Promise<number>,
  ) {
    this.sendFn = sendFn;
    this.getContainerCount = getContainerCount;
  }

  /**
   * Start sending heartbeat messages at the configured interval.
   */
  start(): void {
    if (this.intervalId) return;

    // Take an initial CPU snapshot so the first heartbeat has delta data
    this.previousCpuSnapshot = this.takeCpuSnapshot();

    this.intervalId = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (err) {
        console.error('[WorkerAgent] Heartbeat error:', err);
      }
    }, HEARTBEAT_INTERVAL);

    console.log(
      `[WorkerAgent] Heartbeat started (interval=${HEARTBEAT_INTERVAL / 1000}s)`,
    );
  }

  /**
   * Stop sending heartbeat messages.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[WorkerAgent] Heartbeat stopped');
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async sendHeartbeat(): Promise<void> {
    const cpuUsage = this.getCpuUsage();
    const memoryFree = os.freemem();

    let containersRunning = 0;
    try {
      containersRunning = await this.getContainerCount();
    } catch {
      // If we can't count containers, send 0 rather than failing the heartbeat
    }

    // Disk stats (root filesystem)
    let diskTotal = 0;
    let diskFree = 0;
    try {
      const disk = fs.statfsSync('/');
      diskTotal = disk.blocks * disk.bsize;
      diskFree = disk.bavail * disk.bsize;
    } catch {
      // Disk stats unavailable on some platforms
    }

    this.sendFn({
      type: 'worker.heartbeat',
      cpuUsage,
      memoryFree,
      diskTotal,
      diskFree,
      containersRunning,
    });
  }

  /**
   * Calculate CPU usage percentage by comparing the current CPU times
   * against the previous snapshot. Returns a value between 0 and 100.
   */
  private getCpuUsage(): number {
    const current = this.takeCpuSnapshot();

    if (!this.previousCpuSnapshot) {
      this.previousCpuSnapshot = current;
      return 0;
    }

    const idleDelta = current.idle - this.previousCpuSnapshot.idle;
    const totalDelta = current.total - this.previousCpuSnapshot.total;

    this.previousCpuSnapshot = current;

    if (totalDelta === 0) return 0;
    return Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
  }

  /**
   * Aggregate idle and total CPU time across all cores.
   */
  private takeCpuSnapshot(): CpuSnapshot {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total +=
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.idle +
        cpu.times.irq;
    }

    return { idle, total };
  }
}
