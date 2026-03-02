'use client';

import { useRouter } from 'next/navigation';
import type { ContainerInfo } from '@/core/types';
import { relativeTime, truncate } from '@/core/format';
import { Badge } from '@/common/badge';

interface ContainerCardProps {
  container: ContainerInfo;
}

const statusConfig: Record<string, { label: string; dotClass: string; textClass: string }> = {
  running: { label: 'Running', dotClass: 'bg-vsc-success', textClass: 'text-vsc-success' },
  stopped: { label: 'Stopped', dotClass: 'bg-vsc-text-secondary', textClass: 'text-vsc-text-secondary' },
  creating: { label: 'Creating', dotClass: 'bg-vsc-warning', textClass: 'text-vsc-warning' },
  error: { label: 'Error', dotClass: 'bg-vsc-error', textClass: 'text-vsc-error' },
  removing: { label: 'Removing', dotClass: 'bg-vsc-warning', textClass: 'text-vsc-warning' },
};

export function ContainerCard({ container }: ContainerCardProps) {
  const router = useRouter();
  const status = statusConfig[container.status] ?? statusConfig.stopped;

  return (
    <button
      type="button"
      onClick={() => router.push(`/containers/${container.id}`)}
      className="w-full cursor-pointer rounded border border-vsc-border bg-vsc-bg-secondary p-4 text-left transition-colors hover:border-vsc-accent-blue focus:outline-none focus:ring-1 focus:ring-vsc-accent-blue"
    >
      {/* Header: Name + Status */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-vsc-text-primary">
          {truncate(container.name, 30)}
        </span>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs ${status.textClass}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${status.dotClass}`} />
            {status.label}
          </span>
          {container.managed ? (
            <Badge variant="info">Managed</Badge>
          ) : (
            <Badge variant="default">External</Badge>
          )}
        </div>
      </div>

      {/* Ticket Title or Image Name */}
      <p className="mb-3 text-xs text-vsc-text-secondary">
        {container.ticketTitle
          ? truncate(container.ticketTitle, 60)
          : truncate(container.image, 60)}
      </p>

      {/* Footer: Worker, Branch, Time */}
      <div className="flex items-center justify-between text-xs text-vsc-text-secondary">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1" />
              <path d="M2 10C2 8 4 7 6 7C8 7 10 8 10 10" stroke="currentColor" strokeWidth="1" />
            </svg>
            {container.workerName}
          </span>
          {container.branch && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 1V8M6 8L3 6M6 8L9 6M2 11H10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {truncate(container.branch, 20)}
            </span>
          )}
        </div>
        <span>{relativeTime(container.createdAt)}</span>
      </div>
    </button>
  );
}
