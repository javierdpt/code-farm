'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useTerminal, MAX_RECONNECT_ATTEMPTS } from '@/features/terminal/use-terminal';
import { TerminalSessionDialog } from '@/common/terminal-session-dialog';
import { StatusFooter } from '@/layout/status-footer';

interface TerminalFullscreenProps {
  containerId: string;
  workerId: string;
  containerName?: string;
  workerName?: string;
  image?: string;
  onExit?: () => void;
  workerCount?: number;
  containerCount?: number;
}

export function TerminalFullscreen({
  containerId,
  workerId,
  containerName,
  workerName,
  image,
  onExit,
  workerCount = 0,
  containerCount = 0,
}: TerminalFullscreenProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const { isConnected, wasConnected, isConnecting, reconnectAttempt, disconnect, reconnect } = useTerminal(terminalRef, {
    containerId,
    workerId,
    transparent: true,
  });

  const isReconnecting = reconnectAttempt > 0 && reconnectAttempt <= MAX_RECONNECT_ATTEMPTS && !isConnected;
  const isDisconnected = !isConnected && !isConnecting;

  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide toolbar after 1.5 seconds
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setToolbarVisible(true);
    hideTimerRef.current = setTimeout(() => {
      setToolbarVisible(false);
    }, 1500);
  }, []);

  // Show toolbar when mouse enters the top 10px area
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (e.clientY <= 10) {
        resetHideTimer();
      }
    },
    [resetHideTimer]
  );

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);

    // Start the initial hide timer
    const timer = setTimeout(() => {
      setToolbarVisible(false);
    }, 1500);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timer);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [handleMouseMove]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleBack = useCallback(() => {
    setShowExitDialog(true);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex h-dvh flex-col"
      style={{ backgroundColor: 'rgba(30, 30, 30, 0.88)' }}
    >
      {/* Floating toolbar */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 transition-all duration-300 ${
          toolbarVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
        onMouseEnter={resetHideTimer}
      >
        <div className="flex items-center justify-between px-4 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] bg-vsc-bg-secondary/90 backdrop-blur-sm border-b border-vsc-border">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
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
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              Exit Fullscreen
            </button>

            <div className="w-px h-4 bg-vsc-border" />

            <span className="text-sm text-vsc-text-primary font-medium">
              {containerName || containerId.slice(0, 12)}
            </span>

            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isConnected ? 'bg-vsc-success' : isConnecting ? 'bg-vsc-warning animate-pulse' : 'bg-vsc-error'
                }`}
              />
              <span className="text-xs text-vsc-text-secondary">
                {isConnected ? 'Connected' : isReconnecting ? `Reconnecting (${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})` : isConnecting ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-2.5 py-1 text-xs text-vsc-error hover:bg-vsc-hover rounded transition-colors"
                title="Disconnect terminal session"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={reconnect}
                className="px-2.5 py-1 text-xs text-vsc-success hover:bg-vsc-hover rounded transition-colors"
                title="Reconnect terminal session"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Terminal takes remaining space */}
      <div className="relative z-0 flex-1 w-full">
        <div
          ref={terminalRef}
          className="absolute inset-0"
        />

        {/* Reconnecting overlay */}
        {isReconnecting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-block w-3 h-3 rounded-full bg-vsc-warning animate-pulse" />
              <span className="text-base text-vsc-text-secondary">
                Reconnecting... (attempt {reconnectAttempt}/{MAX_RECONNECT_ATTEMPTS})
              </span>
            </div>
            <button
              type="button"
              onClick={reconnect}
              className="rounded bg-vsc-bg-secondary px-6 py-2 text-sm text-vsc-text-secondary border border-vsc-border transition-colors hover:bg-vsc-hover hover:text-vsc-text-primary"
            >
              Retry Now
            </button>
          </div>
        )}

        {/* Disconnected overlay — shows whenever not connected and not retrying */}
        {isDisconnected && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
            <div className="relative mb-6">
              <span
                className="absolute leading-none"
                style={{ fontSize: 285, top: -100, right: -37, color: 'rgb(236 14 14 / 55%)' }}
              >&#x2298;</span>
              <svg className="mx-auto mt-2 text-vsc-text-secondary/60" width="96" height="96" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="13" width="18" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="6.5" cy="7" r="1" fill="currentColor" />
                <circle cx="6.5" cy="17" r="1" fill="currentColor" />
              </svg>
            </div>
            <p className="mb-4 text-base text-vsc-text-secondary">
              {wasConnected ? 'Terminal disconnected' : 'Could not connect to terminal'}
            </p>
            <button
              type="button"
              onClick={reconnect}
              className="rounded bg-vsc-success px-6 py-2 text-sm text-white transition-colors hover:bg-vsc-success/80"
            >
              {wasConnected ? 'Reconnect' : 'Connect'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="z-10 shrink-0">
        <StatusFooter
          left={
            <>
              <span className="font-medium">{containerName || containerId.slice(0, 12)}</span>
              {workerName && (
                <>
                  <span className="text-white/40">|</span>
                  <div className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1" />
                      <path d="M2 10C2 8 4 7 6 7C8 7 10 8 10 10" stroke="currentColor" strokeWidth="1" />
                    </svg>
                    <span>{workerName}</span>
                  </div>
                </>
              )}
              {image && (
                <>
                  <span className="hidden text-white/40 md:inline">|</span>
                  <div className="hidden items-center gap-1.5 md:flex">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1" y="2" width="10" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
                      <rect x="1" y="7" width="10" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
                    </svg>
                    <span>{image}</span>
                  </div>
                </>
              )}
            </>
          }
          rightCollapsed={
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isConnected ? 'bg-green-300' : isConnecting ? 'bg-yellow-300 animate-pulse' : 'bg-red-300'
              }`}
            />
          }
          right={
            <>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    isConnected ? 'bg-green-300' : isConnecting ? 'bg-yellow-300 animate-pulse' : 'bg-red-300'
                  }`}
                />
                <span>{isConnected ? 'Connected' : isReconnecting ? 'Reconnecting...' : isConnecting ? 'Connecting...' : 'Disconnected'}</span>
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
            </>
          }
        />
      </div>

      {/* Exit confirmation dialog */}
      <TerminalSessionDialog
        open={showExitDialog}
        onConfirm={() => {
          setShowExitDialog(false);
          onExit?.();
        }}
        onCancel={() => setShowExitDialog(false)}
      />
    </div>
  );
}
