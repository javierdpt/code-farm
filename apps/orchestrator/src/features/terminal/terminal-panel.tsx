'use client';

import { useRef, useCallback } from 'react';
import { useTerminal } from '@/features/terminal/use-terminal';

interface TerminalPanelProps {
  containerId: string;
  workerId: string;
  className?: string;
  onFullscreen?: () => void;
}

export function TerminalPanel({
  containerId,
  workerId,
  className,
  onFullscreen,
}: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const { isConnected, disconnect, reconnect } = useTerminal(terminalRef, {
    containerId,
    workerId,
  });

  const handleReconnect = useCallback(() => {
    reconnect();
  }, [reconnect]);

  return (
    <div
      className={`flex flex-col rounded-lg border border-vsc-border bg-vsc-bg-primary overflow-hidden ${className ?? ''}`}
      style={{ minHeight: 300 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-vsc-bg-secondary border-b border-vsc-border select-none shrink-0">
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-vsc-success' : 'bg-vsc-error'
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
          <span className="text-sm text-vsc-text-primary font-medium">Terminal</span>
          <span className="text-xs text-vsc-text-secondary truncate max-w-48">
            {containerId.slice(0, 12)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isConnected && (
            <button
              type="button"
              onClick={handleReconnect}
              className="px-2 py-0.5 text-xs text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
              title="Reconnect"
            >
              Reconnect
            </button>
          )}
          {onFullscreen && (
            <button
              type="button"
              onClick={onFullscreen}
              className="px-2 py-0.5 text-xs text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
              title="Fullscreen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Terminal container */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <div
          ref={terminalRef}
          className="absolute inset-0"
          style={{ padding: 4 }}
        />
      </div>
    </div>
  );
}
