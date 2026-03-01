'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { TicketInput } from '@/components/launch/ticket-input';
import { LaunchConfig } from '@/components/launch/launch-config';
import { LaunchProgress, type LaunchStep } from '@/components/launch/launch-progress';
import type { WorkerInfo } from '@/types';

type LaunchPhase = 'idle' | 'launching' | 'done' | 'error';

// Simple client-side URL pattern matching for provider detection
function detectProviderFromUrl(url: string): string | null {
  if (/github\.com\/.+\/.+\/issues\/\d+/.test(url)) return 'GitHub Issues';
  if (/dev\.azure\.com/.test(url) || /visualstudio\.com/.test(url)) return 'Azure DevOps';
  if (/trello\.com\/c\//.test(url)) return 'Trello';
  if (/monday\.com/.test(url)) return 'Monday.com';
  return null;
}

export default function LaunchPage() {
  const [ticketUrl, setTicketUrl] = useState('');
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [extraInstructions, setExtraInstructions] = useState('');
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [phase, setPhase] = useState<LaunchPhase>('idle');
  const [steps, setSteps] = useState<LaunchStep[]>([]);
  const [containerId, setContainerId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

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

  const handleDetect = useCallback(() => {
    setDetecting(true);
    // Client-side detection from URL pattern
    const provider = detectProviderFromUrl(ticketUrl);
    setDetectedProvider(provider);
    setDetecting(false);
  }, [ticketUrl]);

  const handleLaunch = useCallback(async () => {
    if (!ticketUrl) return;

    setPhase('launching');
    setError(undefined);
    setContainerId(undefined);

    const initialSteps: LaunchStep[] = [
      { label: 'Fetching ticket...', status: 'active' },
      { label: 'Generating CLAUDE.md...', status: 'pending' },
      { label: 'Creating container...', status: 'pending' },
      { label: 'Ready!', status: 'pending' },
    ];
    setSteps(initialSteps);

    try {
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketUrl,
          ...(selectedWorker ? { workerName: selectedWorker } : {}),
          ...(extraInstructions ? { extraInstructions } : {}),
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
  }, [ticketUrl, selectedWorker, extraInstructions]);

  const isLaunching = phase === 'launching';
  const canLaunch = ticketUrl.length > 0 && /^https?:\/\/.+/.test(ticketUrl) && !isLaunching;

  return (
    <AppShell
      title="Launch Container"
      workerCount={workers.filter((w) => w.status === 'online').length}
      containerCount={0}
      connected={workers.some((w) => w.status === 'online')}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Ticket URL Input */}
        <TicketInput
          value={ticketUrl}
          onChange={setTicketUrl}
          detectedProvider={detectedProvider}
          onDetect={handleDetect}
          detecting={detecting}
          disabled={isLaunching}
        />

        {/* Advanced Options */}
        <LaunchConfig
          workers={workers}
          selectedWorker={selectedWorker}
          onWorkerChange={setSelectedWorker}
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
    </AppShell>
  );
}
