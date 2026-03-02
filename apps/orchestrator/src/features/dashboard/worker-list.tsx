'use client';

import type { WorkerInfo } from '@/core/types';
import { WorkerCard } from '@/features/dashboard/worker-card';

interface WorkerListProps {
  workers: WorkerInfo[];
}

export function WorkerList({ workers }: WorkerListProps) {
  if (workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded border border-dashed border-vsc-border py-12 text-center">
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mb-3 text-vsc-text-secondary"
        >
          <circle cx="20" cy="14" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="M8 34C8 28 13 24 20 24C27 24 32 28 32 34" stroke="currentColor" strokeWidth="2" />
        </svg>
        <p className="text-sm text-vsc-text-secondary">No workers connected</p>
        <p className="mt-1 text-xs text-vsc-text-secondary">
          Start a worker agent to begin orchestrating containers.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {workers.map((worker) => (
        <WorkerCard key={worker.id} worker={worker} />
      ))}
    </div>
  );
}
