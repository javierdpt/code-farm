'use client';

import type { WorkerInfo } from '@/types';
import { relativeTime, formatBytes } from '@/lib/format';

interface WorkerCardProps {
  worker: WorkerInfo;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  online: { label: 'Online', className: 'bg-vsc-success' },
  offline: { label: 'Offline', className: 'bg-vsc-error' },
  connecting: { label: 'Connecting', className: 'bg-vsc-warning' },
  error: { label: 'Error', className: 'bg-vsc-error' },
};

const platformIcons: Record<string, string> = {
  linux: 'Linux',
  darwin: 'macOS',
  win32: 'Windows',
};

export function WorkerCard({ worker }: WorkerCardProps) {
  const status = statusConfig[worker.status] ?? statusConfig.offline;
  const platformLabel = platformIcons[worker.platform] ?? worker.platform;

  return (
    <div className="rounded border border-vsc-border bg-vsc-bg-secondary p-4 transition-colors hover:border-vsc-accent-blue">
      {/* Header: Name + Status */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-vsc-text-primary">{worker.name}</span>
        <span className="flex items-center gap-1.5 text-xs text-vsc-text-secondary">
          <span className={`inline-block h-2 w-2 rounded-full ${status.className}`} />
          {status.label}
        </span>
      </div>

      {/* System Info */}
      <div className="space-y-1.5 text-xs text-vsc-text-secondary">
        <div className="flex items-center justify-between">
          <span>Platform</span>
          <span className="text-vsc-text-primary">{platformLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>CPUs</span>
          <span className="text-vsc-text-primary">{worker.cpuCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Memory</span>
          <span className="text-vsc-text-primary">
            {formatBytes(worker.memoryFree)} / {formatBytes(worker.memoryTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Containers</span>
          <span className="text-vsc-text-primary">{worker.containersRunning}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Last heartbeat</span>
          <span className="text-vsc-text-primary">{relativeTime(worker.lastHeartbeat)}</span>
        </div>
      </div>
    </div>
  );
}
