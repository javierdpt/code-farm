'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkerInfo } from '@/core/types';
import { formatBytes } from '@/core/format';

export interface ImageOption {
  id: string;
  name: string;
  tag: string;
  size: number;
}

interface LaunchConfigProps {
  workers: WorkerInfo[];
  selectedWorker: string;
  onWorkerChange: (workerName: string) => void;
  image: string;
  onImageChange: (image: string) => void;
  images: ImageOption[];
  memoryGb: number;
  onMemoryGbChange: (gb: number) => void;
  extraInstructions: string;
  onExtraInstructionsChange: (value: string) => void;
  disabled?: boolean;
}

export function LaunchConfig({
  workers,
  selectedWorker,
  onWorkerChange,
  image,
  onImageChange,
  images,
  memoryGb,
  onMemoryGbChange,
  extraInstructions,
  onExtraInstructionsChange,
  disabled = false,
}: LaunchConfigProps) {
  const [expanded, setExpanded] = useState(false);
  const [showBuildDialog, setShowBuildDialog] = useState(false);
  const router = useRouter();

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

          {/* Container Image */}
          <div className="space-y-1.5">
            <label htmlFor="image-select" className="block text-xs font-medium text-vsc-text-primary">
              Container Image
            </label>
            <select
              id="image-select"
              value={image}
              onChange={(e) => onImageChange(e.target.value)}
              disabled={disabled}
              className="w-full rounded border border-vsc-border bg-vsc-bg-input px-3 py-1.5 text-sm text-vsc-text-primary focus:border-vsc-accent-blue focus:outline-none disabled:opacity-50"
            >
              <option value="">Default (localhost/claude-code-dev:latest)</option>
              {images.map((img) => (
                <option key={`${img.name}:${img.tag}`} value={`${img.name}:${img.tag}`}>
                  {img.name}:{img.tag} ({formatBytes(img.size)})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowBuildDialog(true)}
              disabled={disabled}
              className="mt-1.5 flex items-center gap-1.5 text-xs text-vsc-accent-blue transition-colors hover:text-vsc-accent-blue/80 disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 4V10M4 7H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Create new image
            </button>
          </div>

          {/* Memory (RAM) */}
          <div className="space-y-1.5">
            <label htmlFor="memory-gb" className="block text-xs font-medium text-vsc-text-primary">
              Memory (RAM)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="memory-gb"
                type="number"
                min={1}
                max={64}
                step={1}
                value={memoryGb}
                onChange={(e) => onMemoryGbChange(Math.max(1, parseInt(e.target.value, 10) || 4))}
                disabled={disabled}
                className="w-24 rounded border border-vsc-border bg-vsc-bg-input px-3 py-1.5 text-sm text-vsc-text-primary focus:border-vsc-accent-blue focus:outline-none disabled:opacity-50"
              />
              <span className="text-xs text-vsc-text-secondary">GB</span>
            </div>
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
      {/* Build redirect confirmation dialog */}
      {showBuildDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="mx-4 max-w-lg rounded-lg border border-vsc-border bg-vsc-bg-secondary p-6 shadow-xl">
            <h2 className="mb-3 text-sm font-semibold text-vsc-accent-blue">
              Create Container Image
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-vsc-text-secondary">
              To create a new image, you&apos;ll be redirected to the{' '}
              <span className="text-vsc-text-primary font-medium">Build</span> page where you can
              select a template or provide a custom Containerfile and build it on a worker.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBuildDialog(false)}
                className="rounded border border-vsc-border px-4 py-1.5 text-xs text-vsc-text-secondary transition-colors hover:bg-vsc-hover hover:text-vsc-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBuildDialog(false);
                  router.push('/build');
                }}
                className="rounded bg-vsc-accent-blue px-4 py-1.5 text-xs text-white transition-colors hover:bg-vsc-accent-blue/80"
              >
                Go to Build
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
