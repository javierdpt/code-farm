'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useTerminalManager, type TerminalSession, type DetachedPosition } from './terminal-manager';

// ─── Detached floating window ──────────────────────────────────────────────

const MIN_W = 360;
const MIN_H = 240;

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

function TerminalOverlay({ session }: { session: TerminalSession }) {
  const { minimizeTerminal, closeTerminal, detachTerminal, attachTerminal, updateDetachedPos, bringToFront } = useTerminalManager();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Toolbar auto-hide (fullscreen mode only) ──────────────────────────────
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToolbar = useCallback(() => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = undefined; }
    setToolbarVisible(true);
  }, []);

  const cancelHideTimer = useCallback(() => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = undefined; }
  }, []);

  const hideToolbar = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 2500);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => { if (e.clientY <= 18) showToolbar(); },
    [showToolbar]
  );

  useEffect(() => {
    if (!session.isExpanded) return;
    setToolbarVisible(true);
    document.addEventListener('mousemove', handleMouseMove);
    hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 2500);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = undefined; }
    };
  }, [session.isExpanded, handleMouseMove]);

  // ── Drag / resize state (detached mode) ───────────────────────────────────
  const [isInteracting, setIsInteracting] = useState(false);
  const interactRef = useRef<{
    type: 'drag' | 'resize';
    edge?: ResizeEdge;
    startX: number;
    startY: number;
    startPos: DetachedPosition;
  } | null>(null);
  const floatRef = useRef<HTMLDivElement>(null);

  const applyPos = useCallback((pos: DetachedPosition) => {
    const el = floatRef.current;
    if (!el) return;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    el.style.width = `${pos.w}px`;
    el.style.height = `${pos.h}px`;
  }, []);

  const startDrag = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsInteracting(true);
    interactRef.current = {
      type: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...session.detachedPos },
    };
  }, [session.detachedPos]);

  const startResize = useCallback((e: React.PointerEvent, edge: ResizeEdge) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsInteracting(true);
    interactRef.current = {
      type: 'resize',
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...session.detachedPos },
    };
  }, [session.detachedPos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const info = interactRef.current;
    if (!info) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    const { x: x0, y: y0, w: w0, h: h0 } = info.startPos;

    let { x, y, w, h } = info.startPos;

    if (info.type === 'drag') {
      x = x0 + dx;
      y = Math.max(0, y0 + dy);
    } else if (info.edge) {
      const edge = info.edge;
      if (edge.includes('e')) w = Math.max(MIN_W, w0 + dx);
      if (edge.includes('s')) h = Math.max(MIN_H, h0 + dy);
      if (edge.includes('w')) {
        const nw = Math.max(MIN_W, w0 - dx);
        x = x0 + (w0 - nw);
        w = nw;
      }
      if (edge.includes('n')) {
        const nh = Math.max(MIN_H, h0 - dy);
        y = y0 + (h0 - nh);
        h = nh;
      }
    }

    applyPos({ x, y, w, h });
  }, [applyPos]);

  const onPointerUp = useCallback(() => {
    const info = interactRef.current;
    if (!info) return;
    interactRef.current = null;
    setIsInteracting(false);

    const el = floatRef.current;
    if (!el) return;
    const x = parseInt(el.style.left, 10);
    const y = parseInt(el.style.top, 10);
    const w = parseInt(el.style.width, 10);
    const h = parseInt(el.style.height, 10);
    updateDetachedPos(session.containerId, { x, y, w, h });

    // Notify iframe to resize after window resize
    setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'terminal-visible' }, '*');
    }, 0);
  }, [session.containerId, updateDetachedPos]);

  // ── iframe communication ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session.isExpanded || !iframeRef.current?.contentWindow) return;
    requestAnimationFrame(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'terminal-visible' }, '*');
      iframeRef.current?.contentWindow?.postMessage({ type: 'terminal-focus' }, '*');
    });
  }, [session.isExpanded]);

  useEffect(() => {
    if (session.isDetached) {
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage({ type: 'terminal-visible' }, '*');
        iframeRef.current?.contentWindow?.postMessage({ type: 'terminal-focus' }, '*');
      }, 50);
    }
  }, [session.isDetached]);

  useEffect(() => {
    if (!session.isExpanded || !iframeRef.current?.contentWindow) return;
    const timer = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'terminal-visible' }, '*');
    }, 0);
    return () => clearTimeout(timer);
  }, [toolbarVisible, session.isExpanded]);

  // ── Bring to front when iframe content is clicked (via postMessage) ────────
  useEffect(() => {
    if (!session.isDetached) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'terminal-focus-request' && e.data.containerId === session.containerId) {
        bringToFront(session.containerId);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [session.isDetached, session.containerId, bringToFront]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleMinimize = useCallback(() => { minimizeTerminal(session.containerId); }, [minimizeTerminal, session.containerId]);
  const handleClose = useCallback(() => { closeTerminal(session.containerId); }, [closeTerminal, session.containerId]);
  const handleDetach = useCallback(() => { detachTerminal(session.containerId); }, [detachTerminal, session.containerId]);
  const handleAttach = useCallback(() => { attachTerminal(session.containerId); }, [attachTerminal, session.containerId]);

  const handleOpenInNewTab = useCallback(() => {
    window.open(`/terminal/${session.containerId}?worker=${session.workerId}`, '_blank');
    closeTerminal(session.containerId);
  }, [session.containerId, session.workerId, closeTerminal]);

  const statusDotClass =
    session.status === 'connected'
      ? 'bg-vsc-success'
      : session.status === 'connecting'
        ? 'bg-vsc-warning animate-pulse'
        : 'bg-vsc-error';

  const statusLabel =
    session.status === 'connected' ? 'Connected'
      : session.status === 'connecting' ? 'Connecting...'
        : 'Disconnected';

  // ── Determine mode ──────────────────────────────────────────────────────────
  const isHidden = !session.isExpanded && !session.isDetached;

  // ── Compute root wrapper style per mode ────────────────────────────────────
  let rootClassName: string;
  let rootStyle: React.CSSProperties;

  if (session.isDetached) {
    const { x, y, w, h } = session.detachedPos;
    rootClassName = 'fixed flex flex-col rounded-lg overflow-hidden shadow-2xl border border-vsc-border';
    rootStyle = { left: x, top: y, width: w, height: h, zIndex: 50 + session.zIndex, backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(3px)' };
  } else if (session.isExpanded) {
    rootClassName = 'fixed inset-0 z-40 flex flex-col';
    rootStyle = { backgroundColor: 'rgba(0, 0, 0, 0.95)' };
  } else {
    rootClassName = 'fixed';
    rootStyle = { width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' };
  }

  return (
    <div
      ref={floatRef}
      className={rootClassName}
      style={rootStyle}
      onPointerDown={session.isDetached ? () => bringToFront(session.containerId) : undefined}
      onPointerMove={session.isDetached ? onPointerMove : undefined}
      onPointerUp={session.isDetached ? onPointerUp : undefined}
    >
      {/* ── Detached chrome ─────────────────────────────────────────────────── */}
      {session.isDetached && (
        <>
          {/* Resize handles — 8 directions */}
          <div className="absolute top-0 left-0 w-3 h-3 z-20 cursor-nw-resize" onPointerDown={(e) => startResize(e, 'nw')} />
          <div className="absolute top-0 right-0 w-3 h-3 z-20 cursor-ne-resize" onPointerDown={(e) => startResize(e, 'ne')} />
          <div className="absolute bottom-0 left-0 w-3 h-3 z-20 cursor-sw-resize" onPointerDown={(e) => startResize(e, 'sw')} />
          <div className="absolute bottom-0 right-0 w-3 h-3 z-20 cursor-se-resize" onPointerDown={(e) => startResize(e, 'se')} />
          <div className="absolute top-0 left-3 right-3 h-1 z-20 cursor-n-resize" onPointerDown={(e) => startResize(e, 'n')} />
          <div className="absolute bottom-0 left-3 right-3 h-1 z-20 cursor-s-resize" onPointerDown={(e) => startResize(e, 's')} />
          <div className="absolute top-3 bottom-3 left-0 w-1 z-20 cursor-w-resize" onPointerDown={(e) => startResize(e, 'w')} />
          <div className="absolute top-3 bottom-3 right-0 w-1 z-20 cursor-e-resize" onPointerDown={(e) => startResize(e, 'e')} />

          {/* Title bar — drag handle */}
          <div
            className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-vsc-bg-secondary/90 backdrop-blur-sm border-b border-vsc-border cursor-grab active:cursor-grabbing select-none"
            onPointerDown={startDrag}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${statusDotClass}`} />
              <span className="text-sm text-vsc-text-primary font-medium truncate max-w-48">
                {session.containerName || session.containerId.slice(0, 12)}
              </span>
              <span className="text-xs text-vsc-text-secondary">{statusLabel}</span>
            </div>

            <div className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" onClick={handleAttach}
                className="flex items-center px-2 py-1 text-xs text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
                title="Expand fullscreen">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
              <button type="button" onClick={handleOpenInNewTab}
                className="flex items-center px-2 py-1 text-xs text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
                title="Open in new tab">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
              <button type="button" onClick={handleMinimize}
                className="flex items-center px-2 py-1 text-xs text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
                title="Minimize">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="18" x2="19" y2="18" />
                </svg>
              </button>
              <button type="button" onClick={handleClose}
                className="flex items-center px-2 py-1 text-xs text-vsc-text-secondary hover:text-vsc-error hover:bg-vsc-hover rounded transition-colors"
                title="Close">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Fullscreen chrome ───────────────────────────────────────────────── */}
      {session.isExpanded && (
        <>
          {!toolbarVisible && (
            <div
              className="absolute top-0 left-0 right-0 z-20 h-[18px]"
              onMouseEnter={showToolbar}
              onClick={() => iframeRef.current?.focus()}
            />
          )}

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
                  <span className="text-xs text-vsc-text-secondary">{statusLabel}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button type="button" onClick={handleDetach}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
                  title="Pop out as floating window">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18M3 9h6" />
                  </svg>
                </button>
                <button type="button" onClick={handleOpenInNewTab}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
                  title="Open in new tab">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </button>
                <button type="button" onClick={handleMinimize}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-vsc-text-secondary hover:text-vsc-text-primary hover:bg-vsc-hover rounded transition-colors"
                  title="Minimize">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="18" x2="19" y2="18" />
                  </svg>
                </button>
                <button type="button" onClick={handleClose}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-vsc-text-secondary hover:text-vsc-error hover:bg-vsc-hover rounded transition-colors"
                  title="Close terminal">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Single persistent iframe — never unmounted while session exists ── */}
      <iframe
        ref={iframeRef}
        src={`/terminal/${session.containerId}?worker=${session.workerId}&detached=true`}
        className={isHidden ? '' : 'flex-1 w-full border-0'}
        style={{
          pointerEvents: isInteracting ? 'none' : 'auto',
          background: 'transparent',
          ...(session.isDetached ? {
            opacity: session.status === 'connected' ? 1 : 0,
            transition: 'opacity 150ms',
          } : {}),
        }}
        allowTransparency={true}
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
