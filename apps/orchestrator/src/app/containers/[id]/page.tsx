'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/layout/app-shell';
import { TerminalPanel } from '@/features/terminal/terminal-panel';
import { TerminalSessionDialog } from '@/common/terminal-session-dialog';
import { relativeTime, formatBytes } from '@/core/format';
import type { ContainerInfo } from '@/core/types';

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
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [showFullscreenDialog, setShowFullscreenDialog] = useState(false);
  const [adoptForm, setAdoptForm] = useState({
    ticketUrl: '',
    ticketTitle: '',
    repoUrl: '',
    branch: '',
  });

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

  const handleStart = useCallback(async () => {
    if (!containerId || starting) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/containers/${containerId}/start`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await fetchContainer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start container');
    } finally {
      setStarting(false);
    }
  }, [containerId, starting, fetchContainer]);

  const handleStop = useCallback(async () => {
    if (!containerId || stopping) return;
    setStopping(true);
    try {
      const res = await fetch(`/api/containers/${containerId}/stop`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await fetchContainer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop container');
    } finally {
      setStopping(false);
    }
  }, [containerId, stopping, fetchContainer]);

  const handleRemove = useCallback(async () => {
    if (!containerId || removing) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/containers/${containerId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      router.push('/containers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove container');
    } finally {
      setRemoving(false);
    }
  }, [containerId, removing, router]);

  const handleAdopt = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!containerId || adopting) return;
      setAdopting(true);
      try {
        const res = await fetch(`/api/containers/${containerId}/adopt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adoptForm),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        // Refresh container data on success
        await fetchContainer();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to adopt container');
      } finally {
        setAdopting(false);
      }
    },
    [containerId, adopting, adoptForm, fetchContainer],
  );

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
      <div className="flex h-full flex-col gap-6">
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
                  <button
                    type="button"
                    onClick={() => setShowFullscreenDialog(true)}
                    className="rounded bg-vsc-accent-blue px-3 py-1.5 text-xs text-white transition-colors hover:bg-vsc-accent-blue/80"
                  >
                    Open Fullscreen Terminal
                  </button>
                  <button
                    type="button"
                    onClick={handleStop}
                    disabled={stopping}
                    className="rounded border border-vsc-warning/50 px-3 py-1.5 text-xs text-vsc-warning transition-colors hover:bg-vsc-warning/10 disabled:opacity-50"
                  >
                    {stopping ? 'Stopping...' : 'Stop'}
                  </button>
                </>
              )}
              {container.status === 'stopped' && (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={starting}
                  className="rounded bg-vsc-success px-3 py-1.5 text-xs text-white transition-colors hover:bg-vsc-success/80 disabled:opacity-50"
                >
                  {starting ? 'Starting...' : 'Start'}
                </button>
              )}
              {(container.status === 'stopped' || container.status === 'running') && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="rounded border border-vsc-error/50 px-3 py-1.5 text-xs text-vsc-error transition-colors hover:bg-vsc-error/10 disabled:opacity-50"
                >
                  {removing ? 'Removing...' : 'Remove'}
                </button>
              )}
            </div>
          </div>

          {/* Detail Grid */}
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
            {container.ticketTitle && (
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
            )}
            {container.repoUrl && (
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
            )}
            {container.branch && (
              <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
                <span className="text-vsc-text-secondary">Branch</span>
                <span className="text-vsc-text-primary">{container.branch}</span>
              </div>
            )}
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
            {container.resources && (
              <>
                <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
                  <span className="text-vsc-text-secondary">CPU</span>
                  <span className="text-vsc-text-primary">
                    {container.status === 'running' ? `${container.resources.cpuPercent.toFixed(1)}%` : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
                  <span className="text-vsc-text-secondary">Memory</span>
                  <span className="text-vsc-text-primary">
                    {container.status === 'running' ? formatBytes(container.resources.memoryUsage) : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-vsc-bg-tertiary px-3 py-2">
                  <span className="text-vsc-text-secondary">Disk</span>
                  <span className="text-vsc-text-primary">
                    {container.resources.diskUsage > 0 ? formatBytes(container.resources.diskUsage) : '--'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Adopt Section — for unmanaged containers */}
        {!container.managed && (
          <div className="rounded border border-vsc-border bg-vsc-bg-secondary p-4">
            <h3 className="mb-3 text-sm font-semibold text-vsc-text-primary">
              Adopt Container
            </h3>
            <p className="mb-4 text-xs text-vsc-text-secondary">
              This container is not managed by Code Farm. Fill in the details below to adopt it.
            </p>
            <form onSubmit={handleAdopt} className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-vsc-text-secondary">Ticket URL</span>
                <input
                  type="url"
                  value={adoptForm.ticketUrl}
                  onChange={(e) => setAdoptForm((f) => ({ ...f, ticketUrl: e.target.value }))}
                  placeholder="https://linear.app/team/ISSUE-123"
                  className="rounded border border-vsc-border bg-vsc-bg-tertiary px-3 py-1.5 text-vsc-text-primary placeholder:text-vsc-text-secondary/50 focus:border-vsc-accent-blue focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-vsc-text-secondary">Ticket Title</span>
                <input
                  type="text"
                  value={adoptForm.ticketTitle}
                  onChange={(e) => setAdoptForm((f) => ({ ...f, ticketTitle: e.target.value }))}
                  placeholder="Fix login bug"
                  className="rounded border border-vsc-border bg-vsc-bg-tertiary px-3 py-1.5 text-vsc-text-primary placeholder:text-vsc-text-secondary/50 focus:border-vsc-accent-blue focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-vsc-text-secondary">Repo URL</span>
                <input
                  type="url"
                  value={adoptForm.repoUrl}
                  onChange={(e) => setAdoptForm((f) => ({ ...f, repoUrl: e.target.value }))}
                  placeholder="https://github.com/org/repo"
                  className="rounded border border-vsc-border bg-vsc-bg-tertiary px-3 py-1.5 text-vsc-text-primary placeholder:text-vsc-text-secondary/50 focus:border-vsc-accent-blue focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-vsc-text-secondary">Branch</span>
                <input
                  type="text"
                  value={adoptForm.branch}
                  onChange={(e) => setAdoptForm((f) => ({ ...f, branch: e.target.value }))}
                  placeholder="feat/my-branch"
                  className="rounded border border-vsc-border bg-vsc-bg-tertiary px-3 py-1.5 text-vsc-text-primary placeholder:text-vsc-text-secondary/50 focus:border-vsc-accent-blue focus:outline-none"
                />
              </label>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={adopting}
                  className="rounded bg-vsc-accent-blue px-4 py-1.5 text-xs text-white transition-colors hover:bg-vsc-accent-blue/80 disabled:opacity-50"
                >
                  {adopting ? 'Adopting...' : 'Adopt Container'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Terminal Panel */}
        {container.status === 'running' && (
          <TerminalPanel
            containerId={containerId}
            workerId={container.workerId}
            className="min-h-80 flex-1"
            onFullscreen={() => setShowFullscreenDialog(true)}
          />
        )}
      </div>

      {/* Fullscreen confirmation dialog */}
      <TerminalSessionDialog
        open={showFullscreenDialog}
        onConfirm={() => {
          setShowFullscreenDialog(false);
          router.push(`/terminal/${containerId}?worker=${container.workerId}`);
        }}
        onCancel={() => setShowFullscreenDialog(false)}
      />
    </AppShell>
  );
}
