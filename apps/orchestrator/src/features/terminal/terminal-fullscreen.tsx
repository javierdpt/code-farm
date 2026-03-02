'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useTerminal } from '@/features/terminal/use-terminal';
import { TerminalSessionDialog } from '@/common/terminal-session-dialog';

interface TerminalFullscreenProps {
  containerId: string;
  workerId: string;
  containerName?: string;
  onExit?: () => void;
}

export function TerminalFullscreen({
  containerId,
  workerId,
  containerName,
  onExit,
}: TerminalFullscreenProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const { isConnected, disconnect } = useTerminal(terminalRef, {
    containerId,
    workerId,
    transparent: true,
  });

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
      className="fixed inset-0 z-50"
      style={{ width: '100vw', height: '100vh', backgroundColor: 'rgba(30, 30, 30, 0.88)' }}
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
        <div className="flex items-center justify-between px-4 py-2 bg-vsc-bg-secondary/90 backdrop-blur-sm border-b border-vsc-border">
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
                  isConnected ? 'bg-vsc-success' : 'bg-vsc-error'
                }`}
              />
              <span className="text-xs text-vsc-text-secondary">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-2.5 py-1 text-xs text-vsc-error hover:bg-vsc-hover rounded transition-colors"
              title="Disconnect terminal session"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      {/* Terminal takes full viewport */}
      <div
        ref={terminalRef}
        className="relative z-0 w-full h-full"
        style={{ padding: 4 }}
      />

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
