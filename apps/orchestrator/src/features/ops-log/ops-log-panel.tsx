'use client';

import { useEffect, useRef } from 'react';
import { useOpsLog, type OpsLogEntry } from './ops-log-provider';

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function LevelIcon({ level }: { level: OpsLogEntry['level'] }) {
  switch (level) {
    case 'info':
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <circle cx="6" cy="6" r="5" stroke="#3b82f6" strokeWidth="1.5" />
          <circle cx="6" cy="6" r="2" fill="#3b82f6" />
        </svg>
      );
    case 'warn':
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <path d="M6 1L11 10H1L6 1Z" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case 'error':
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <circle cx="6" cy="6" r="5" stroke="#ef4444" strokeWidth="1.5" />
          <path d="M4 4L8 8M8 4L4 8" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

function levelColor(level: OpsLogEntry['level']): string {
  switch (level) {
    case 'info':
      return 'text-blue-400';
    case 'warn':
      return 'text-amber-400';
    case 'error':
      return 'text-red-400';
  }
}

export function OpsLogPanel() {
  const { logs, isOpen, setIsOpen, clearUnread } = useOpsLog();
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // Clear unread when opened
  useEffect(() => {
    if (isOpen) {
      clearUnread();
    }
  }, [isOpen, clearUnread]);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (isOpen && shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  // Track whether user has scrolled away from the bottom
  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 40;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-8 left-1/2 z-50 w-[800px] max-w-[calc(100vw-2rem)] -translate-x-1/2">
      <div className="flex flex-col overflow-hidden rounded-lg border border-vsc-border bg-vsc-bg-secondary shadow-2xl">
        {/* Header */}
        <div className="flex h-9 items-center justify-between border-b border-vsc-border px-3">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-vsc-text-secondary">
              <rect x="1" y="3" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <path d="M3 6L5 8L3 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 10H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium text-vsc-text-primary">Operations Log</span>
            <span className="text-xs text-vsc-text-secondary">({logs.length})</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-5 w-5 items-center justify-center rounded text-vsc-text-secondary hover:bg-vsc-hover hover:text-vsc-text-primary transition-colors"
            aria-label="Close operations log"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Log entries */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[300px] overflow-y-auto overflow-x-hidden"
        >
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-vsc-text-secondary">
              No operations logged yet
            </div>
          ) : (
            <div className="divide-y divide-vsc-border/30">
              {logs.map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className="flex items-start gap-2 px-3 py-1.5 hover:bg-vsc-hover/50 transition-colors"
                >
                  <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-vsc-text-secondary/60">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className="pt-0.5">
                    <LevelIcon level={entry.level} />
                  </span>
                  {entry.workerName && (
                    <span className="shrink-0 text-xs text-vsc-text-secondary/50">
                      [{entry.workerName}]
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-mono ${levelColor(entry.level)}`}>
                      {entry.message}
                    </span>
                    {entry.command && (
                      <div className="mt-0.5 truncate text-[10px] font-mono text-vsc-text-secondary/40">
                        $ {entry.command}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
