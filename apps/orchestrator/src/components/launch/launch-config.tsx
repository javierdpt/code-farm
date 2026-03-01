'use client';

import { useState } from 'react';
import type { WorkerInfo } from '@/types';

interface LaunchConfigProps {
  workers: WorkerInfo[];
  selectedWorker: string;
  onWorkerChange: (workerName: string) => void;
  extraInstructions: string;
  onExtraInstructionsChange: (value: string) => void;
  disabled?: boolean;
}

export function LaunchConfig({
  workers,
  selectedWorker,
  onWorkerChange,
  extraInstructions,
  onExtraInstructionsChange,
  disabled = false,
}: LaunchConfigProps) {
  const [expanded, setExpanded] = useState(false);

  const onlineWorkers = workers.filter((w) => w.status === 'online');

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-vsc-text-secondary transition-colors hover:text-vsc-text-primary"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Advanced Options
      </button>

      {expanded && (
        <div className="space-y-4 rounded border border-vsc-border bg-vsc-bg-tertiary p-4">
          {/* Worker Selector */}
          <div className="space-y-1.5">
            <label htmlFor="worker-select" className="block text-xs font-medium text-vsc-text-primary">
              Target Worker
            </label>
            <select
              id="worker-select"
              value={selectedWorker}
              onChange={(e) => onWorkerChange(e.target.value)}
              disabled={disabled}
              className="w-full rounded border border-vsc-border bg-vsc-bg-input px-3 py-1.5 text-sm text-vsc-text-primary focus:border-vsc-accent-blue focus:outline-none disabled:opacity-50"
            >
              <option value="">Auto (least loaded)</option>
              {onlineWorkers.map((worker) => (
                <option key={worker.id} value={worker.name}>
                  {worker.name} ({worker.containersRunning} containers)
                </option>
              ))}
            </select>
            <p className="text-xs text-vsc-text-secondary">
              {onlineWorkers.length === 0
                ? 'No workers online. A worker must be connected to launch.'
                : `${onlineWorkers.length} worker${onlineWorkers.length !== 1 ? 's' : ''} available`}
            </p>
          </div>

          {/* Extra Instructions */}
          <div className="space-y-1.5">
            <label htmlFor="extra-instructions" className="block text-xs font-medium text-vsc-text-primary">
              Extra Instructions
            </label>
            <textarea
              id="extra-instructions"
              value={extraInstructions}
              onChange={(e) => onExtraInstructionsChange(e.target.value)}
              disabled={disabled}
              rows={4}
              placeholder="Additional context or instructions to include in the generated CLAUDE.md..."
              className="w-full resize-y rounded border border-vsc-border bg-vsc-bg-input px-3 py-2 text-sm text-vsc-text-primary placeholder:text-vsc-text-secondary focus:border-vsc-accent-blue focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
