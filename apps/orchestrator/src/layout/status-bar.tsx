'use client';

import { useOpsLog } from '@/features/ops-log/ops-log-provider';

interface StatusBarProps {
  connected?: boolean;
  workerCount?: number;
  containerCount?: number;
}

export function StatusBar({
  connected = false,
  workerCount = 0,
  containerCount = 0,
}: StatusBarProps) {
  const { unreadCount, isOpen, setIsOpen } = useOpsLog();

  return (
    <footer className="flex h-6 items-center justify-between bg-vsc-status-bar px-3 text-xs text-white">
      {/* Left: Branding + Ops Log toggle */}
      <div className="flex items-center gap-3">
        <span className="font-medium">Code Farm</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-white/10"
          aria-label="Toggle operations log"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="2.5" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1" />
            <path d="M2.5 5L4.5 7L2.5 9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 9H9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <span>Ops</span>
          {unreadCount > 0 && (
            <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold leading-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Right: Status indicators */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              connected ? 'bg-green-300' : 'bg-red-300'
            }`}
          />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1" />
            <path d="M2 10C2 8 4 7 6 7C8 7 10 8 10 10" stroke="currentColor" strokeWidth="1" />
          </svg>
          <span>{workerCount} worker{workerCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="2" width="10" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
            <rect x="1" y="7" width="10" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
          </svg>
          <span>{containerCount} container{containerCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </footer>
  );
}
