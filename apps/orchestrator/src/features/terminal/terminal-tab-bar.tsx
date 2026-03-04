'use client';

import { useCallback } from 'react';
import { useTerminalManager } from './terminal-manager';

export function TerminalTabBar() {
  const { terminals, expandTerminal, closeTerminal } = useTerminalManager();

  const minimized = terminals.filter((t) => !t.isExpanded);
  if (minimized.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-vsc-border bg-vsc-bg-secondary px-2 py-1.5">
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {minimized.map((session) => (
          <TerminalTab key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}

function TerminalTab({ session }: { session: { id: string; containerId: string; workerId: string; containerName: string; status: string } }) {
  const { expandTerminal, closeTerminal } = useTerminalManager();

  const handleExpand = useCallback(() => {
    expandTerminal(session.containerId);
  }, [expandTerminal, session.containerId]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    closeTerminal(session.containerId);
  }, [closeTerminal, session.containerId]);

  const handleOpenInNewTab = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(
      `/terminal/${session.containerId}?worker=${session.workerId}`,
      '_blank'
    );
    closeTerminal(session.containerId);
  }, [session.containerId, session.workerId, closeTerminal]);

  const dotClass =
    session.status === 'connected'
      ? 'bg-white'
      : session.status === 'connecting'
        ? 'bg-yellow-300 animate-pulse'
        : 'bg-red-400';

  return (
    <button
      type="button"
      onClick={handleExpand}
      onDoubleClick={handleExpand}
      className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-white transition-colors hover:brightness-110"
      style={{ backgroundColor: '#0dbc79' }}
      title={session.containerName || session.containerId}
    >
      {/* Connection dot */}
      <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />

      {/* Container name */}
      <span className="truncate flex-1 text-left font-medium">
        {session.containerName || session.containerId.slice(0, 12)}
      </span>

      {/* Expand icon */}
      <span
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        title="Expand"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </span>

      {/* Open in new tab icon */}
      <span
        role="button"
        tabIndex={-1}
        onClick={handleOpenInNewTab}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        title="Open in new tab"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </span>

      {/* Close icon */}
      <span
        role="button"
        tabIndex={-1}
        onClick={handleClose}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        title="Close"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    </button>
  );
}
