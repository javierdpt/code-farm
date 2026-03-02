'use client';

import type { ContainerInfo } from '@/core/types';
import { ContainerCard } from '@/features/containers/container-card';

interface ContainerListProps {
  containers: ContainerInfo[];
}

export function ContainerList({ containers }: ContainerListProps) {
  if (containers.length === 0) {
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
          <rect x="6" y="6" width="28" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
          <rect x="6" y="22" width="28" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="28" r="2" fill="currentColor" />
        </svg>
        <p className="text-sm text-vsc-text-secondary">No containers running</p>
        <p className="mt-1 text-xs text-vsc-text-secondary">
          Launch a container from the{' '}
          <a href="/launch" className="text-vsc-accent-blue hover:underline">
            Launch
          </a>{' '}
          page to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {containers.map((container) => (
        <ContainerCard key={container.id} container={container} />
      ))}
    </div>
  );
}
