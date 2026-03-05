'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useTerminal, MAX_RECONNECT_ATTEMPTS } from '@/features/terminal/use-terminal';
import { useVisualViewport } from '@/hooks/use-visual-viewport';
import { TerminalSessionDialog } from '@/common/terminal-session-dialog';
import { StatusFooter } from '@/layout/status-footer';

function useIsEmbedded() {
  const [state, setState] = useState({ embedded: false, ready: false });
  useEffect(() => {
    setState({ embedded: window.self !== window.top, ready: true });
  }, []);
  return state;
}

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
  const { embedded: isEmbedded, ready: isReady } = useIsEmbedded();
  const viewport = useVisualViewport();
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const { isConnected, wasConnected, isConnecting, reconnectAttempt, disconnect, reconnect } = useTerminal(terminalRef, {
    containerId,
    workerId,
    transparent: true,
  });

  const isReconnecting = reconnectAttempt > 0 && reconnectAttempt <= MAX_RECONNECT_ATTEMPTS && !isConnected;
  const isDisconnected = !isConnected && !isConnecting;

  // Prevent iOS page scroll when keyboard is open
  useEffect(() => {
    if (!viewport?.keyboardOpen) return;
    const preventScroll = (e: TouchEvent) => {
      // Allow scrolling inside the terminal (xterm handles its own scroll)
      const target = e.target as HTMLElement;
      if (target.closest('.xterm')) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', preventScroll, { passive: false });
    // Also force scroll to 0 on mount
    window.scrollTo(0, 0);
    return () => {
      document.removeEventListener('touchmove', preventScroll);
    };
  }, [viewport?.keyboardOpen]);

  // When embedded in iframe: post connection status to parent
  useEffect(() => {
    if (!isEmbedded) return;
    const status = isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected';
    window.parent.postMessage({ type: 'terminal-status', containerId, status }, '*');
  }, [isEmbedded, isConnected, isConnecting, containerId]);

  // When embedded: listen for visibility/focus messages from parent
  useEffect(() => {
    if (!isEmbedded) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'terminal-visible') {
        window.dispatchEvent(new Event('resize'));
      }
      if (e.data?.type === 'terminal-focus') {
        const textarea = document.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null;
        textarea?.focus();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isEmbedded]);

  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToolbar = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setToolbarVisible(true);
    hideTimerRef.current = setTimeout(() => {
      setToolbarVisible(false);
    }, 1500);
  }, []);

  const cancelHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
  }, []);

  const hideToolbar = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setToolbarVisible(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (e.clientY <= 18) {
        showToolbar();
      }
    },
    [showToolbar]
  );

  useEffect(() => {
    // Toolbar auto-hide only for standalone mode
    if (!isReady || isEmbedded) return;
    document.addEventListener('mousemove', handleMouseMove);
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
  }, [isReady, isEmbedded, handleMouseMove]);

  // Trigger terminal resize after toolbar show/hide transition
  useEffect(() => {
    if (!isReady || isEmbedded) return;
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 0);
    return () => clearTimeout(timer);
  }, [toolbarVisible, isReady, isEmbedded]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleBack = useCallback(() => {
    setShowExitDialog(true);
  }, []);

  // Single return: the terminal ref div is always in the same tree position.
  // Toolbar and status bar are conditionally rendered based on isEmbedded.
  return (
    <div
      className={`fixed left-0 right-0 flex flex-col ${isEmbedded ? '' : 'z-50'}`}
      style={{
        backgroundColor: 'rgba(30, 30, 30, 0.88)',
        top: viewport ? `${viewport.offsetTop}px` : 0,
        height: viewport ? `${viewport.height}px` : '100dvh',
      }}
    >
      {/* In-flow toolbar — standalone only, pushes content down when visible */}
      {isReady && !isEmbedded && (
        <div
          className="shrink-0 z-10 overflow-hidden"
          style={{ maxHeight: toolbarVisible ? '60px' : '0' }}
          onMouseMove={cancelHideTimer}
          onMouseLeave={hideToolbar}
        >
          <div className="flex items-center justify-between px-4 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] bg-vsc-bg-secondary/90 backdrop-blur-sm border-b border-vsc-border">
            <div className="flex items-center gap-3">
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

              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
                title="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal — always in same tree position */}
      <div className="terminal-fullscreen relative z-0 flex-1 w-full" style={{ backgroundColor: '#000' }}>
        <div
          ref={terminalRef}
          className="absolute inset-0"
        />

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

      {/* Exit confirmation dialog — standalone only */}
      {!isEmbedded && (
        <TerminalSessionDialog
          open={showExitDialog}
          onConfirm={() => {
            setShowExitDialog(false);
            onExit?.();
          }}
          onCancel={() => setShowExitDialog(false)}
        />
      )}
    </div>
  );
}
