'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface UseTerminalOptions {
  containerId: string;
  workerId: string;
  transparent?: boolean;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

interface UseTerminalReturn {
  isConnected: boolean;
  wasConnected: boolean;
  isConnecting: boolean;
  reconnectAttempt: number;
  disconnect: () => void;
  reconnect: () => void;
}

export const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 15000;

const THEME = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

type Terminal = import('@xterm/xterm').Terminal;
type FitAddon = import('@xterm/addon-fit').FitAddon;

export function useTerminal(
  terminalRef: React.RefObject<HTMLDivElement | null>,
  options: UseTerminalOptions
): UseTerminalReturn {
  const { containerId, workerId, transparent, onConnected, onDisconnected, onError } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [wasConnected, setWasConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true); // true on mount — connecting immediately
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const sessionReadyRef = useRef(false);
  const connectGenRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalRef = useRef(false);

  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;
  onErrorRef.current = onError;

  const cleanup = useCallback(() => {
    sessionReadyRef.current = false;

    if (wsRef.current) {
      // Detach handlers before closing to prevent onclose from triggering auto-reconnect
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.dispose();
      terminalInstanceRef.current = null;
    }

    fitAddonRef.current = null;

    if (mountedRef.current) {
      setIsConnected(false);
    }
  }, []);

  const connect = useCallback(async () => {
    const el = terminalRef.current;
    if (!el) return;

    // Clean up any existing instance (handlers detached — no spurious onclose)
    cleanup();

    // Mark as connecting
    if (mountedRef.current) setIsConnecting(true);

    const gen = ++connectGenRef.current;

    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      document.fonts.ready,
    ]);

    if (!mountedRef.current || gen !== connectGenRef.current) return;

    const theme = transparent
      ? { ...THEME, background: 'rgba(0, 0, 0, 0.85)' }
      : THEME;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const terminal = new Terminal({
      theme,
      fontFamily: "'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace",
      fontSize: isMobile ? 10 : 14,
      cursorBlink: true,
      allowTransparency: !!transparent,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.open(el);

    /** Center the character grid by shifting .xterm-screen so the
     *  sub-cell-size remainder gap is distributed evenly on all sides. */
    const centerGrid = () => {
      const screenEl = el.querySelector('.xterm-screen') as HTMLElement | null;
      const rowsEl = el.querySelector('.xterm-rows') as HTMLElement | null;
      const viewportEl = el.querySelector('.xterm-viewport') as HTMLElement | null;
      if (!screenEl || !rowsEl?.firstElementChild || !viewportEl) return;
      const vw = viewportEl.clientWidth;
      const vh = viewportEl.clientHeight;
      const gw = (rowsEl.firstElementChild as HTMLElement).getBoundingClientRect().width;
      const gh = rowsEl.getBoundingClientRect().height;
      const dx = Math.floor((vw - gw) / 2);
      const dy = Math.floor((vh - gh) / 2);
      screenEl.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : '';
    };

    try {
      fitAddon.fit();
      centerGrid();
    } catch {
      // FitAddon can throw if the element has zero size; ignore on first pass
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const cols = terminal.cols;
    const rows = terminal.rows;
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/terminal?containerId=${encodeURIComponent(containerId)}&workerId=${encodeURIComponent(workerId)}&cols=${cols}&rows=${rows}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // WebSocket is open, but we wait for terminal.opened before marking as connected
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'terminal.opened') {
            sessionReadyRef.current = true;
            reconnectAttemptRef.current = 0;
            setReconnectAttempt(0);
            intentionalRef.current = false;
            setIsConnected(true);
            setIsConnecting(false);
            setWasConnected(true);
            onConnectedRef.current?.();
            return;
          }

          if (msg.type === 'terminal.output') {
            const binary = atob(msg.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            terminal.write(bytes);
            return;
          }

          if (msg.type === 'terminal.closed') {
            terminal.write('\r\n\x1b[31m[Terminal session closed]\x1b[0m\r\n');
            setIsConnected(false);
            setIsConnecting(false);
            onDisconnectedRef.current?.();
            return;
          }
        } catch {
          terminal.write(event.data);
        }
      } else if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((buf) => {
          terminal.write(new Uint8Array(buf));
        });
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      sessionReadyRef.current = false;
      setIsConnected(false);
      setIsConnecting(false);
      onDisconnectedRef.current?.();

      // Auto-reconnect with exponential backoff
      if (!intentionalRef.current && mountedRef.current) {
        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        setReconnectAttempt(attempt);
        if (attempt <= MAX_RECONNECT_ATTEMPTS) {
          setIsConnecting(true);
          const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, attempt - 1), RECONNECT_MAX_DELAY);
          reconnectTimerRef.current = setTimeout(() => connect(), delay);
        }
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      onErrorRef.current?.('WebSocket connection failed');
    };

    // Terminal input -> WebSocket
    terminal.onData((data: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && sessionReadyRef.current) {
        wsRef.current.send(data);
      }
    });

    // Handle resize + mobile font size adaptation
    const mobileMq = window.matchMedia('(max-width: 768px)');
    const handleMobileChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (!terminalInstanceRef.current) return;
      terminalInstanceRef.current.options.fontSize = e.matches ? 10 : 14;
      try {
        fitAddonRef.current?.fit();
        centerGrid();
      } catch { /* ignore */ }
    };
    mobileMq.addEventListener('change', handleMobileChange);

    const handleResize = () => {
      if (!fitAddonRef.current || !terminalInstanceRef.current) return;
      try {
        fitAddonRef.current.fit();
        centerGrid();
      } catch {
        // Ignore fit errors (e.g. zero-size element)
      }
    };

    terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && sessionReadyRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'terminal.browser.resize',
            cols,
            rows,
          })
        );
      }
    });

    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (el) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(el);
    }

    // visualViewport listener — catches iOS keyboard open/close that window.resize misses
    const vv = window.visualViewport;
    let handleViewportResize: (() => void) | null = null;
    if (vv) {
      let vpTimer: ReturnType<typeof setTimeout> | null = null;
      handleViewportResize = () => {
        // Slight delay to let iOS finish keyboard animation and container resize
        if (vpTimer) clearTimeout(vpTimer);
        vpTimer = setTimeout(() => {
          try { fitAddonRef.current?.fit(); centerGrid(); } catch { /* ignore */ }
        }, 150);
      };
      vv.addEventListener('resize', handleViewportResize);
      vv.addEventListener('scroll', handleViewportResize);
    }

    const currentTerminal = terminalInstanceRef.current;
    const originalDispose = currentTerminal.dispose.bind(currentTerminal);
    currentTerminal.dispose = () => {
      window.removeEventListener('resize', handleResize);
      mobileMq.removeEventListener('change', handleMobileChange);
      resizeObserver?.disconnect();
      if (vv && handleViewportResize) {
        vv.removeEventListener('resize', handleViewportResize);
        vv.removeEventListener('scroll', handleViewportResize);
      }
      originalDispose();
    };
  }, [containerId, workerId, transparent, terminalRef, cleanup]);

  const disconnect = useCallback(() => {
    intentionalRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    setIsConnecting(false);
    cleanup();
  }, [cleanup]);

  const reconnect = useCallback(() => {
    // Cancel any pending auto-reconnect
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    intentionalRef.current = false;
    // connect() will call cleanup() which detaches old WS handlers first
    connect();
  }, [connect]);

  // Connect on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      cleanup();
    };
  }, [connect, cleanup]);

  return { isConnected, wasConnected, isConnecting, reconnectAttempt, disconnect, reconnect };
}
