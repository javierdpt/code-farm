'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ContainerInfo } from '@/core/types';
import { relativeTime, truncate, formatBytes } from '@/core/format';
import { Badge } from '@/common/badge';
import { ContainerName } from '@/common/container-name';

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
      className="flex w-full cursor-pointer flex-col justify-start rounded border border-vsc-border bg-vsc-bg-secondary/95 p-4 text-left transition-colors hover:border-vsc-accent-blue focus:outline-none focus:ring-1 focus:ring-vsc-accent-blue"
    >
      {/* Header: Name + Status */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">
          <ContainerName name={container.name} />
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

      {/* Resource Stats */}
      {container.resources && (
        <div className="mb-3 flex items-center gap-3 text-xs text-vsc-text-secondary">
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="3" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
              <path d="M3 5V7M5 5V7M7 5V7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <span className="text-vsc-text-primary">
              {container.status === 'running' ? `${container.resources.cpuPercent.toFixed(0)}%` : '--'}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="1" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1" />
              <path d="M4 4H8M4 6H6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <span className="text-vsc-text-primary">
              {container.status === 'running' ? formatBytes(container.resources.memoryUsage) : '--'}
            </span>
          </span>
          {container.resources.diskUsage > 0 && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" />
                <circle cx="6" cy="6" r="1.5" fill="currentColor" />
              </svg>
              <span className="text-vsc-text-primary">{formatBytes(container.resources.diskUsage)}</span>
            </span>
          )}
        </div>
      )}

      {/* Footer: Worker, Branch, Time */}
      <div className="mb-3 mt-auto flex items-center justify-between text-xs text-vsc-text-secondary">
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

      {/* Open in Terminal button */}
      {container.status === 'running' && (
        <Link
          href={`/terminal/${container.id}?worker=${container.workerId}`}
          onClick={(e) => e.stopPropagation()}
          className="flex w-full items-center justify-center gap-2 rounded border border-vsc-accent-blue/40 bg-vsc-accent-blue/10 py-2 text-xs font-medium text-vsc-accent-blue transition-colors hover:bg-vsc-accent-blue/20"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="2.5" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M4 6.5L6.5 9L4 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 11.5H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Open in Terminal
        </Link>
      )}
    </button>
  );
}
