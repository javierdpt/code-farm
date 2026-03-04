'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/layout/app-shell';
import { TicketInput } from '@/features/launch/ticket-input';
import { LaunchConfig, type ImageOption, type PodmanArg } from '@/features/launch/launch-config';
import { LaunchProgress, type LaunchStep } from '@/features/launch/launch-progress';
import { ConnectionConfigDialog, loadConnections, providerKey } from '@/features/launch/connection-config-dialog';
import type { WorkerInfo } from '@/core/types';

type LaunchPhase = 'idle' | 'launching' | 'done' | 'error';

/** Extract short image name, e.g. "localhost/claude-code-dev:latest" → "claude-code-dev" */
function imageShortName(img: string): string {
  const fallback = 'claude-code-dev';
  if (!img) return fallback;
  return img.split('/').pop()?.split(':')[0] || fallback;
}

// Simple client-side URL pattern matching for provider detection
function detectProviderFromUrl(url: string): string | null {
  if (/github\.com\/.+\/.+\/issues\/\d+/.test(url)) return 'GitHub Issues';
  if (/dev\.azure\.com/.test(url) || /visualstudio\.com/.test(url)) return 'Azure DevOps';
  if (/trello\.com\/c\//.test(url)) return 'Trello';
  if (/monday\.com/.test(url)) return 'Monday.com';
  return null;
}

const DEFAULT_PODMAN_ARGS: PodmanArg[] = [
  { flag: '-v', value: 'claude-config:/home/developer/.claude' },
  { flag: '-v', value: 'gh-config:/home/developer/.config/gh' },
];

type LaunchMode = 'issue' | 'empty';

export default function LaunchPage() {
  const [launchMode, setLaunchMode] = useState<LaunchMode>('issue');
  const [ticketUrl, setTicketUrl] = useState('');
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [extraInstructions, setExtraInstructions] = useState('');
  const [image, setImage] = useState('');
  const [memoryGb, setMemoryGb] = useState(4);
  const [containerName, setContainerName] = useState(imageShortName(''));
  const [podmanArgs, setPodmanArgs] = useState<PodmanArg[]>(DEFAULT_PODMAN_ARGS);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [images, setImages] = useState<ImageOption[]>([]);
  const [phase, setPhase] = useState<LaunchPhase>('idle');
  const [steps, setSteps] = useState<LaunchStep[]>([]);
  const [containerId, setContainerId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [configOpen, setConfigOpen] = useState(false);

  // Fetch workers list
  useEffect(() => {
    async function fetchWorkers() {
      try {
        const res = await fetch('/api/workers');
        if (res.ok) {
          const data = await res.json();
          setWorkers(data.workers ?? []);
        }
      } catch {
        // ignore
      }
    }
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch images list
  useEffect(() => {
    async function fetchImages() {
      try {
        const res = await fetch('/api/images');
        if (res.ok) {
          const data = await res.json();
          setImages(data.images ?? []);
        }
      } catch {
        // ignore
      }
    }
    fetchImages();
    const interval = setInterval(fetchImages, 30000);
    return () => clearInterval(interval);
  }, []);

  // Track whether user has manually edited the name
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  // Pre-fill container name from image when image changes (unless user edited)
  useEffect(() => {
    if (!nameManuallyEdited) {
      setContainerName(imageShortName(image));
    }
  }, [image, nameManuallyEdited]);

  const handleDetect = useCallback(() => {
    setDetecting(true);
    // Client-side detection from URL pattern
    const provider = detectProviderFromUrl(ticketUrl);
    setDetectedProvider(provider);
    setDetecting(false);
  }, [ticketUrl]);

  const handleLaunch = useCallback(async () => {
    if (launchMode === 'issue' && !ticketUrl) return;

    setPhase('launching');
    setError(undefined);
    setContainerId(undefined);

    const memoryMb = memoryGb * 1024;
    const filteredArgs = podmanArgs.filter((a) => a.flag.trim() && a.value.trim());

    if (launchMode === 'empty') {
      const initialSteps: LaunchStep[] = [
        { label: 'Creating container...', status: 'active' },
        { label: 'Ready!', status: 'pending' },
      ];
      setSteps(initialSteps);

      try {
        const res = await fetch('/api/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(containerName.trim() ? { name: containerName.trim() } : {}),
            ...(selectedWorker ? { workerName: selectedWorker } : {}),
            ...(image ? { image } : {}),
            memoryMb,
            ...(filteredArgs.length ? { podmanArgs: filteredArgs } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const data = await res.json();

        await new Promise((r) => setTimeout(r, 300));

        setSteps([
          { label: 'Creating container...', status: 'success' },
          { label: 'Ready!', status: 'success' },
        ]);

        setContainerId(data.container?.id);
        setPhase('done');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setSteps((prev) =>
          prev.map((s) =>
            s.status === 'active'
              ? { ...s, status: 'error' }
              : s,
          ),
        );
        setPhase('error');
      }
    } else {
      const initialSteps: LaunchStep[] = [
        { label: 'Fetching ticket...', status: 'active' },
        { label: 'Generating CLAUDE.md...', status: 'pending' },
        { label: 'Creating container...', status: 'pending' },
        { label: 'Ready!', status: 'pending' },
      ];
      setSteps(initialSteps);

      try {
        const connections = loadConnections();
        const key = providerKey(detectedProvider);
        const token = key ? connections[key] : undefined;

        const res = await fetch('/api/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketUrl,
            ...(containerName.trim() ? { name: containerName.trim() } : {}),
            ...(selectedWorker ? { workerName: selectedWorker } : {}),
            ...(extraInstructions ? { extraInstructions } : {}),
            ...(image ? { image } : {}),
            memoryMb,
            ...(token ? { token } : {}),
            ...(filteredArgs.length ? { podmanArgs: filteredArgs } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        // The launch API does all steps server-side and returns the result.
        // We simulate step-by-step progress for the UX.
        setSteps((prev) =>
          prev.map((s, i) =>
            i === 0
              ? { ...s, status: 'success', label: 'Fetching ticket...' }
              : i === 1
                ? { ...s, status: 'active' }
                : s,
          ),
        );

        // Small delay for visual feedback
        await new Promise((r) => setTimeout(r, 300));

        setSteps((prev) =>
          prev.map((s, i) =>
            i === 1
              ? { ...s, status: 'success', label: 'Generating CLAUDE.md...' }
              : i === 2
                ? { ...s, status: 'active' }
                : s,
          ),
        );

        await new Promise((r) => setTimeout(r, 300));

        const data = await res.json();

        setSteps((prev) =>
          prev.map((s, i) =>
            i === 2
              ? { ...s, status: 'success', label: 'Creating container...' }
              : i === 3
                ? { ...s, status: 'success', label: 'Ready!' }
                : s,
          ),
        );

        setContainerId(data.container?.id);
        setPhase('done');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setSteps((prev) =>
          prev.map((s) =>
            s.status === 'active'
              ? { ...s, status: 'error' }
              : s,
          ),
        );
        setPhase('error');
      }
    }
  }, [launchMode, ticketUrl, containerName, selectedWorker, extraInstructions, image, memoryGb, podmanArgs, detectedProvider]);

  const isLaunching = phase === 'launching';
  const canLaunch =
    launchMode === 'issue'
      ? ticketUrl.length > 0 && /^https?:\/\/.+/.test(ticketUrl) && !isLaunching
      : !isLaunching;

  return (
    <AppShell
      title="Launch Container"
      workerCount={workers.filter((w) => w.status === 'online').length}
      containerCount={0}
      connected={workers.some((w) => w.status === 'online')}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Mode Tabs */}
        <div className="flex gap-1 rounded bg-vsc-bg-tertiary p-1">
          <button
            type="button"
            onClick={() => setLaunchMode('issue')}
            disabled={isLaunching}
            className={`flex-1 rounded px-4 py-1.5 text-sm font-medium transition-colors ${
              launchMode === 'issue'
                ? 'bg-vsc-accent-blue text-white'
                : 'bg-vsc-bg-tertiary text-vsc-text-secondary hover:text-vsc-text-primary'
            } disabled:cursor-not-allowed`}
          >
            From Issue
          </button>
          <button
            type="button"
            onClick={() => setLaunchMode('empty')}
            disabled={isLaunching}
            className={`flex-1 rounded px-4 py-1.5 text-sm font-medium transition-colors ${
              launchMode === 'empty'
                ? 'bg-vsc-accent-blue text-white'
                : 'bg-vsc-bg-tertiary text-vsc-text-secondary hover:text-vsc-text-primary'
            } disabled:cursor-not-allowed`}
          >
            Empty
          </button>
        </div>

        {launchMode === 'issue' ? (
          /* Ticket URL Input */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-vsc-text-primary">Ticket URL</span>
              <button
                type="button"
                onClick={() => setConfigOpen(true)}
                title="Configure provider connections"
                className="text-vsc-text-secondary transition-colors hover:text-vsc-text-primary"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6.5 1H9.5L10 3L12 4L14 3L15.5 5.5L14 7.5V8.5L15.5 10.5L14 13L12 12L10 13L9.5 15H6.5L6 13L4 12L2 13L0.5 10.5L2 8.5V7.5L0.5 5.5L2 3L4 4L6 3L6.5 1Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
            </div>
            <TicketInput
              value={ticketUrl}
              onChange={setTicketUrl}
              detectedProvider={detectedProvider}
              onDetect={handleDetect}
              detecting={detecting}
              disabled={isLaunching}
              onOpenConfig={() => setConfigOpen(true)}
            />
          </div>
        ) : null}

        {/* Container Name — shared between both modes */}
        <div className="space-y-2">
          <label htmlFor="container-name" className="block text-sm font-medium text-vsc-text-primary">
            Container Name
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id="container-name"
                type="text"
                value={containerName}
                onChange={(e) => {
                  setContainerName(e.target.value);
                  setNameManuallyEdited(true);
                }}
                disabled={isLaunching}
                placeholder={
                  launchMode === 'issue'
                    ? '<image>-<provider><owner>-<id>'
                    : '<image>-<name>'
                }
                className="w-full rounded border border-vsc-border bg-vsc-bg-input px-3 py-2 pr-8 text-sm text-vsc-text-primary placeholder:text-vsc-text-secondary focus:border-vsc-accent-blue focus:outline-none disabled:opacity-50"
              />
              {containerName && !isLaunching && (
                <button
                  type="button"
                  onClick={() => {
                    setContainerName('');
                    setNameManuallyEdited(true);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-vsc-text-secondary transition-colors hover:text-vsc-text-primary"
                  title="Clear name"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
            {nameManuallyEdited && (
              <button
                type="button"
                onClick={() => {
                  setNameManuallyEdited(false);
                  setContainerName(imageShortName(image));
                }}
                disabled={isLaunching}
                className="flex-shrink-0 rounded bg-vsc-bg-tertiary px-2 py-2 text-xs text-vsc-text-secondary transition-colors hover:bg-vsc-hover hover:text-vsc-text-primary disabled:opacity-50"
                title="Reset to default"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2V5H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2.5 5A4.5 4.5 0 1 1 3 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-xs text-vsc-text-secondary">
            {launchMode === 'issue'
              ? 'Auto-appended: -<provider><owner>-<ticketId>'
              : 'Leave empty for auto-generated name'}
          </p>
        </div>

        {/* Advanced Options — shared between both modes */}
        <LaunchConfig
          workers={workers}
          selectedWorker={selectedWorker}
          onWorkerChange={setSelectedWorker}
          image={image}
          onImageChange={setImage}
          images={images}
          memoryGb={memoryGb}
          onMemoryGbChange={setMemoryGb}
          podmanArgs={podmanArgs}
          onPodmanArgsChange={setPodmanArgs}
          extraInstructions={extraInstructions}
          onExtraInstructionsChange={setExtraInstructions}
          disabled={isLaunching}
        />

        {/* Launch Button */}
        <button
          type="button"
          onClick={handleLaunch}
          disabled={!canLaunch}
          className="w-full rounded bg-vsc-accent-blue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vsc-accent-blue/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLaunching ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M14 8A6 6 0 0 0 8 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Launching...
            </span>
          ) : (
            'Launch'
          )}
        </button>

        {/* Progress Steps */}
        {phase !== 'idle' && (
          <LaunchProgress steps={steps} containerId={containerId} error={error} />
        )}
      </div>

      <ConnectionConfigDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
      />
    </AppShell>
  );
}
