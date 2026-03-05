'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useTerminalManager, type TerminalSession } from './terminal-manager';

function TerminalOverlay({ session }: { session: TerminalSession }) {
  const { minimizeTerminal, closeTerminal } = useTerminalManager();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-hide toolbar (same pattern as standalone TerminalFullscreen)
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToolbar = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setToolbarVisible(true);
    hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 1500);
  }, []);

  const cancelHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const hideToolbar = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setToolbarVisible(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (e.clientY <= 18) showToolbar();
    },
    [showToolbar]
  );

  useEffect(() => {
    if (!session.isExpanded) return;
    // Reset toolbar visibility when expanding
    setToolbarVisible(true);
    document.addEventListener('mousemove', handleMouseMove);
    const timer = setTimeout(() => setToolbarVisible(false), 1500);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [session.isExpanded, handleMouseMove]);

  const handleMinimize = useCallback(() => {
    minimizeTerminal(session.containerId);
  }, [minimizeTerminal, session.containerId]);

  const handleClose = useCallback(() => {
    closeTerminal(session.containerId);
  }, [closeTerminal, session.containerId]);

  const handleOpenInNewTab = useCallback(() => {
    window.open(
      `/terminal/${session.containerId}?worker=${session.workerId}`,
      '_blank'
    );
    closeTerminal(session.containerId);
  }, [session.containerId, session.workerId, closeTerminal]);

  // When expanded, notify iframe to resize and focus
  useEffect(() => {
    if (!session.isExpanded || !iframeRef.current?.contentWindow) return;
    requestAnimationFrame(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'terminal-visible' }, '*');
      iframeRef.current?.contentWindow?.postMessage({ type: 'terminal-focus' }, '*');
    });
  }, [session.isExpanded]);

  // Notify iframe to resize after toolbar show/hide transition
  useEffect(() => {
    if (!session.isExpanded || !iframeRef.current?.contentWindow) return;
    const timer = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'terminal-visible' }, '*');
    }, 0);
    return () => clearTimeout(timer);
  }, [toolbarVisible, session.isExpanded]);

  const statusDotClass =
    session.status === 'connected'
      ? 'bg-vsc-success'
      : session.status === 'connecting'
        ? 'bg-vsc-warning animate-pulse'
        : 'bg-vsc-error';

  // Single return: one persistent iframe, overlay chrome conditionally rendered.
  // When minimized the wrapper is hidden but the iframe stays in the DOM.
  return (
    <div
      className={session.isExpanded ? 'fixed inset-0 z-40 flex flex-col' : ''}
      style={session.isExpanded ? { backgroundColor: 'rgba(30, 30, 30, 0.95)' } : { display: 'none' }}
    >
      {/* Toolbar — only when expanded */}
      {session.isExpanded && (
        <>
          {/* Invisible hover zone at top — captures mouse above iframe to trigger toolbar */}
          {!toolbarVisible && (
            <div
              className="absolute top-0 left-0 right-0 z-20 h-[18px]"
              onMouseEnter={showToolbar}
            />
          )}

          {/* In-flow auto-hide toolbar — pushes content down when visible */}
          <div
            className="shrink-0 z-10 overflow-hidden"
            style={{ maxHeight: toolbarVisible ? '60px' : '0' }}
            onMouseMove={cancelHideTimer}
            onMouseLeave={hideToolbar}
          >
            <div className="flex items-center justify-between px-4 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] bg-vsc-bg-secondary/90 backdrop-blur-sm border-b border-vsc-border">
              <div className="flex items-center gap-3">
                <span className="text-sm text-vsc-text-primary font-medium truncate max-w-60">
                  {session.containerName || session.containerId.slice(0, 12)}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${statusDotClass}`} />
                  <span className="text-xs text-vsc-text-secondary">
                    {session.status === 'connected'
                      ? 'Connected'
                      : session.status === 'connecting'
                        ? 'Connecting...'
                        : 'Disconnected'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Open in new tab */}
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
                  title="Open in new tab"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </button>

                {/* Minimize */}
                <button
                  type="button"
                  onClick={handleMinimize}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
                  title="Minimize"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="18" x2="19" y2="18" />
                  </svg>
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-vsc-text-secondary hover:text-vsc-error hover:bg-vsc-hover rounded transition-colors"
                  title="Close terminal"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Single persistent iframe — never unmounted while session exists */}
      <iframe
        ref={iframeRef}
        src={`/terminal/${session.containerId}?worker=${session.workerId}`}
        className={session.isExpanded ? 'flex-1 w-full border-0' : ''}
        title={`Terminal: ${session.containerName}`}
      />
    </div>
  );
}

export function TerminalIframeLayer() {
  const { terminals } = useTerminalManager();

  if (terminals.length === 0) return null;

  return (
    <>
      {terminals.map((session) => (
        <TerminalOverlay key={session.id} session={session} />
      ))}
    </>
  );
}
