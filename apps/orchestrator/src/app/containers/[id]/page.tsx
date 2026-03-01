'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { TerminalPanel } from '@/components/terminal/terminal-panel';
import { relativeTime } from '@/lib/format';
import type { ContainerInfo } from '@/types';

const statusConfig: Record<string, { label: string; dotClass: string; textClass: string }> = {
  running: { label: 'Running', dotClass: 'bg-vsc-success', textClass: 'text-vsc-success' },
  stopped: { label: 'Stopped', dotClass: 'bg-vsc-text-secondary', textClass: 'text-vsc-text-secondary' },
  creating: { label: 'Creating', dotClass: 'bg-vsc-warning', textClass: 'text-vsc-warning' },
  error: { label: 'Error', dotClass: 'bg-vsc-error', textClass: 'text-vsc-error' },
  removing: { label: 'Removing', dotClass: 'bg-vsc-warning', textClass: 'text-vsc-warning' },
};

export default function ContainerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const containerId = params.id;

  const [container, setContainer] = useState<ContainerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  const fetchContainer = useCallback(async () => {
    try {
      const res = await fetch(`/api/containers/${containerId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Container not found');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setContainer(data.container);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch container');
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  useEffect(() => {
    fetchContainer();
    const interval = setInterval(fetchContainer, 5000);
    return () => clearInterval(interval);
  }, [fetchContainer]);

  const handleStop = useCallback(async () => {
    if (!containerId || stopping) return;
    setStopping(true);
    try {
      const res = await fetch(`/api/containers/${containerId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      // Refresh data
      await fetchContainer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop container');
    } finally {
      setStopping(false);
    }
  }, [containerId, stopping, fetchContainer]);

  if (loading) {
    return (
      <AppShell title="Container" breadcrumb={['Containers']}>
        <div className="flex items-center justify-center py-20">
          <svg className="h-8 w-8 animate-spin text-vsc-accent-blue" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
            <path d="M22 12A10 10 0 0 0 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </AppShell>
    );
  }

  if (error && !container) {
    return (
      <AppShell title="Container" breadcrumb={['Containers']}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-vsc-error">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/containers')}
            className="mt-4 rounded bg-vsc-bg-tertiary px-4 py-2 text-sm text-vsc-text-primary transition-colors hover:bg-vsc-hover"
          >
            Back to Containers
          </button>
        </div>
      </AppShell>
    );
  }

  if (!container) return null;

  const status = statusConfig[container.status] ?? statusConfig.stopped;

  return (
    <AppShell
      title={container.name}
      breadcrumb={['Containers', container.name]}
    >
      <div className="space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="rounded border border-vsc-error/30 bg-vsc-error/10 px-3 py-2 text-sm text-vsc-error">
            {error}
          </div>
        )}

        {/* Container Info */}
        <div className="rounded border border-vsc-border bg-vsc-bg-secondary p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-vsc-text-primary">{container.name}</h2>
              <span className={`flex items-center gap-1.5 text-xs ${status.textClass}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${status.dotClass}`} />
                {status.label}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {container.status === 'running' && (
                <>
                  <Link
                    href={`/terminal/${containerId}?worker=${container.workerId}`}
                    className="rounded bg-vsc-accent-blue px-3 py-1.5 text-xs text-white transition-colors hover:bg-vsc-accent-blue/80"
                  >
                    Open Fullscreen Terminal
                  </Link>
                  <button
                    type="button"
                    onClick={handleStop}
                    disabled={stopping}
                    className="rounded border border-vsc-error/50 px-3 py-1.5 text-xs text-vsc-error transition-colors hover:bg-vsc-error/10 disabled:opacity-50"
                  >
                    {stopping ? 'Stopping...' : 'Stop'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Detail Grid */}
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
            <div className="flex items-start justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Ticket</span>
              <a
                href={container.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 truncate text-right text-vsc-accent-blue hover:underline"
              >
                {container.ticketTitle}
              </a>
            </div>
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Repo</span>
              <a
                href={container.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 truncate text-vsc-accent-blue hover:underline"
              >
                {container.repoUrl}
              </a>
            </div>
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Branch</span>
              <span className="text-vsc-text-primary">{container.branch}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Worker</span>
              <span className="text-vsc-text-primary">{container.workerName}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Image</span>
              <span className="text-vsc-text-primary">{container.image}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
              <span className="text-vsc-text-secondary">Created</span>
              <span className="text-vsc-text-primary">{relativeTime(container.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Terminal Panel */}
        {container.status === 'running' && (
          <TerminalPanel
            containerId={containerId}
            workerId={container.workerId}
            className="h-80"
            onFullscreen={() => router.push(`/terminal/${containerId}?worker=${container.workerId}`)}
          />
        )}
      </div>
    </AppShell>
  );
}
