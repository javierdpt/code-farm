'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/layout/app-shell';
import { ContainerList } from '@/features/containers/container-list';
import { relativeTime, formatBytes } from '@/core/format';
import type { WorkerInfo, ContainerInfo } from '@/core/types';

const statusConfig: Record<string, { label: string; dotClass: string; textClass: string }> = {
  online: { label: 'Online', dotClass: 'bg-vsc-success', textClass: 'text-vsc-success' },
  offline: { label: 'Offline', dotClass: 'bg-vsc-error', textClass: 'text-vsc-error' },
  connecting: { label: 'Connecting', dotClass: 'bg-vsc-warning', textClass: 'text-vsc-warning' },
  error: { label: 'Error', dotClass: 'bg-vsc-error', textClass: 'text-vsc-error' },
};

const platformLabels: Record<string, string> = {
  linux: 'Linux',
  darwin: 'macOS',
  win32: 'Windows',
};

export default function WorkerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workerId = params.id;

  const [worker, setWorker] = useState<WorkerInfo | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [workerRes, containersRes] = await Promise.all([
        fetch(`/api/workers/${workerId}`),
        fetch('/api/containers'),
      ]);

      if (!workerRes.ok) {
        if (workerRes.status === 404) {
          setError('Worker not found');
          return;
        }
        throw new Error(`HTTP ${workerRes.status}`);
      }

      const workerData = await workerRes.json();
      setWorker(workerData.worker);
      setError(null);

      if (containersRes.ok) {
        const containerData = await containersRes.json();
        setContainers(containerData.containers ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch worker');
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const workerContainers = useMemo(
    () => containers.filter((c) => c.workerId === workerId),
    [containers, workerId],
  );

  if (loading) {
    return (
      <AppShell title="Worker" breadcrumb={['Workers']}>
        <div className="flex items-center justify-center py-20">
          <svg className="h-8 w-8 animate-spin text-vsc-accent-blue" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
            <path d="M22 12A10 10 0 0 0 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </AppShell>
    );
  }

  if (error && !worker) {
    return (
      <AppShell title="Worker" breadcrumb={['Workers']}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-vsc-error">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/workers')}
            className="mt-4 rounded bg-vsc-bg-tertiary px-4 py-2 text-sm text-vsc-text-primary transition-colors hover:bg-vsc-hover"
          >
            Back to Workers
          </button>
        </div>
      </AppShell>
    );
  }

  if (!worker) return null;

  const status = statusConfig[worker.status] ?? statusConfig.offline;

  return (
    <AppShell title={worker.name} breadcrumb={['Workers', worker.name]}>
      <div className="flex flex-col gap-6">
        {/* Worker Info */}
        <div className="rounded border border-vsc-border bg-vsc-bg-secondary p-4">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-sm font-semibold text-vsc-text-primary">{worker.name}</h2>
            <span className={`flex items-center gap-1.5 text-xs ${status.textClass}`}>
              <span className={`inline-block h-2 w-2 rounded-full ${status.dotClass}`} />
              {status.label}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Hostname</span>
              <span className="text-vsc-text-primary">{worker.hostname}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Platform</span>
              <span className="text-vsc-text-primary">{platformLabels[worker.platform] ?? worker.platform}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">CPU</span>
              <span className="text-vsc-text-primary">
                {worker.cpuUsage != null ? `${worker.cpuUsage}%` : '—'} ({worker.cpuCount} cores)
              </span>
            </div>
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Memory</span>
              <span className="text-vsc-text-primary">
                {formatBytes(worker.memoryTotal - worker.memoryFree)} / {formatBytes(worker.memoryTotal)}
              </span>
            </div>
            {worker.diskTotal != null && worker.diskTotal > 0 && (
              <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
                <span className="text-vsc-text-secondary">Disk</span>
                <span className="text-vsc-text-primary">
                  {formatBytes(worker.diskTotal - (worker.diskFree ?? 0))} / {formatBytes(worker.diskTotal)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Containers</span>
              <span className="text-vsc-text-primary">{worker.containersRunning}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Connected</span>
              <span className="text-vsc-text-primary">{relativeTime(worker.connectedAt)}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Last heartbeat</span>
              <span className="text-vsc-text-primary">{relativeTime(worker.lastHeartbeat)}</span>
            </div>
          </div>
        </div>

        {/* Containers on this Worker */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-vsc-text-primary">
            Containers on this worker
            <span className="ml-2 text-xs font-normal text-vsc-text-secondary">
              ({workerContainers.length})
            </span>
          </h2>
          <ContainerList containers={workerContainers} />
        </section>
      </div>
    </AppShell>
  );
}
