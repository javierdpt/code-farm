'use client';

import { useRef, useCallback } from 'react';
import { useTerminal, MAX_RECONNECT_ATTEMPTS } from '@/features/terminal/use-terminal';

interface TerminalPanelProps {
  containerId: string;
  workerId: string;
  className?: string;
  transparent?: boolean;
  onFullscreen?: () => void;
}

export function TerminalPanel({
  containerId,
  workerId,
  className,
  transparent,
  onFullscreen,
}: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const { isConnected, wasConnected, isConnecting, reconnectAttempt, disconnect, reconnect } = useTerminal(terminalRef, {
    containerId,
    workerId,
    transparent,
  });

  const isReconnecting = reconnectAttempt > 0 && reconnectAttempt <= MAX_RECONNECT_ATTEMPTS && !isConnected;
  const isDisconnected = !isConnected && !isConnecting;

  const handleReconnect = useCallback(() => {
    reconnect();
  }, [reconnect]);

  return (
    <div
      className={`flex flex-col rounded-lg border border-vsc-border overflow-hidden ${transparent ? 'bg-transparent' : 'bg-vsc-bg-primary'} ${className ?? ''}`}
      style={{ minHeight: 300 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-vsc-bg-secondary border-b border-vsc-border select-none shrink-0">
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-vsc-success' : isConnecting ? 'bg-vsc-warning animate-pulse' : 'bg-vsc-error'
            }`}
            title={isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          />
          <span className="text-sm text-vsc-text-primary font-medium">Terminal</span>
          <span className="text-xs text-vsc-text-secondary truncate max-w-48">
            {containerId.slice(0, 12)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isDisconnected && (
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
        />

        {/* Reconnecting overlay */}
        {isReconnecting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-vsc-bg-primary/90">
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-vsc-warning animate-pulse" />
              <span className="text-sm text-vsc-text-secondary">
                Reconnecting... (attempt {reconnectAttempt}/{MAX_RECONNECT_ATTEMPTS})
              </span>
            </div>
            <button
              type="button"
              onClick={handleReconnect}
              className="rounded bg-vsc-bg-secondary px-4 py-1.5 text-xs text-vsc-text-secondary border border-vsc-border transition-colors hover:bg-vsc-hover hover:text-vsc-text-primary"
            >
              Retry Now
            </button>
          </div>
        )}

        {/* Disconnected overlay — shows when not connected and not trying to connect */}
        {isDisconnected && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-vsc-bg-primary/90">
            <div className="relative mb-4">
              <span
                className="absolute leading-none"
                style={{ fontSize: 142, top: -50, right: -18, color: 'rgb(236 14 14 / 55%)' }}
              >&#x2298;</span>
              <svg className="mx-auto mt-1 text-vsc-text-secondary/60" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="13" width="18" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="6.5" cy="7" r="1" fill="currentColor" />
                <circle cx="6.5" cy="17" r="1" fill="currentColor" />
              </svg>
            </div>
            <p className="mb-3 text-sm text-vsc-text-secondary">
              {wasConnected ? 'Terminal disconnected' : 'Could not connect to terminal'}
            </p>
            <button
              type="button"
              onClick={handleReconnect}
              className="rounded bg-vsc-success px-4 py-1.5 text-xs text-white transition-colors hover:bg-vsc-success/80"
            >
              {wasConnected ? 'Reconnect' : 'Connect'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
