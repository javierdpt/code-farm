'use client';

import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';

export interface DetachedPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TerminalSession {
  id: string;
  containerId: string;
  workerId: string;
  containerName: string;
  workerName: string;
  status: 'connecting' | 'connected' | 'disconnected';
  isExpanded: boolean;
  isDetached: boolean;
  detachedPos: DetachedPosition;
  restoreAsDetached: boolean;
}

interface OpenTerminalInfo {
  containerId: string;
  workerId: string;
  containerName: string;
  workerName: string;
}

interface TerminalManagerContextValue {
  terminals: TerminalSession[];
  openTerminal: (info: OpenTerminalInfo) => void;
  openTerminalDetached: (info: OpenTerminalInfo) => void;
  closeTerminal: (containerId: string) => void;
  expandTerminal: (containerId: string) => void;
  minimizeTerminal: (containerId: string) => void;
  detachTerminal: (containerId: string) => void;
  attachTerminal: (containerId: string) => void;
  updateDetachedPos: (containerId: string, pos: DetachedPosition) => void;
}

const TerminalManagerContext = createContext<TerminalManagerContextValue | null>(null);

export function useTerminalManager() {
  const ctx = useContext(TerminalManagerContext);
  if (!ctx) throw new Error('useTerminalManager must be used within TerminalManagerProvider');
  return ctx;
}

function defaultDetachedPos(index: number): DetachedPosition {
  const offset = index * 24;
  return { x: 80 + offset, y: 80 + offset, w: 860, h: 540 };
}

export function TerminalManagerProvider({ children }: { children: ReactNode }) {
  const [terminals, setTerminals] = useState<TerminalSession[]>([]);

  const openTerminal = useCallback((info: OpenTerminalInfo) => {
    setTerminals((prev) => {
      const existing = prev.find((t) => t.containerId === info.containerId);
      if (existing) {
        // Expand existing, minimize all others
        return prev.map((t) => ({
          ...t,
          isExpanded: t.containerId === info.containerId,
        }));
      }
      // Add new terminal (expanded), minimize all others
      const minimized = prev.map((t) => ({ ...t, isExpanded: false }));
      return [
        ...minimized,
        {
          id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36),
          containerId: info.containerId,
          workerId: info.workerId,
          containerName: info.containerName,
          workerName: info.workerName,
          status: 'connecting',
          isExpanded: true,
          isDetached: false,
          detachedPos: defaultDetachedPos(prev.length),
          restoreAsDetached: false,
        },
      ];
    });
  }, []);

  const openTerminalDetached = useCallback((info: OpenTerminalInfo) => {
    setTerminals((prev) => {
      const existing = prev.find((t) => t.containerId === info.containerId);
      if (existing) {
        return prev.map((t) =>
          t.containerId === info.containerId
            ? { ...t, isDetached: true, isExpanded: false, restoreAsDetached: false }
            : t
        );
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36),
          containerId: info.containerId,
          workerId: info.workerId,
          containerName: info.containerName,
          workerName: info.workerName,
          status: 'connecting',
          isExpanded: false,
          isDetached: true,
          detachedPos: defaultDetachedPos(prev.length),
          restoreAsDetached: false,
        },
      ];
    });
  }, []);

  const closeTerminal = useCallback((containerId: string) => {
    setTerminals((prev) => prev.filter((t) => t.containerId !== containerId));
  }, []);

  const expandTerminal = useCallback((containerId: string) => {
    setTerminals((prev) => {
      const target = prev.find((t) => t.containerId === containerId);
      if (target?.restoreAsDetached) {
        // Restore to detached floating — don't collapse other terminals
        return prev.map((t) =>
          t.containerId === containerId
            ? { ...t, isDetached: true, isExpanded: false, restoreAsDetached: false }
            : t
        );
      }
      // Restore to fullscreen — collapse all others
      return prev.map((t) => ({
        ...t,
        isExpanded: t.containerId === containerId,
        isDetached: t.containerId === containerId ? false : t.isDetached,
        restoreAsDetached: t.containerId === containerId ? false : t.restoreAsDetached,
      }));
    });
  }, []);

  const minimizeTerminal = useCallback((containerId: string) => {
    setTerminals((prev) =>
      prev.map((t) =>
        t.containerId === containerId
          ? { ...t, isExpanded: false, isDetached: false, restoreAsDetached: t.isDetached }
          : t
      )
    );
  }, []);

  const detachTerminal = useCallback((containerId: string) => {
    setTerminals((prev) =>
      prev.map((t) =>
        t.containerId === containerId ? { ...t, isExpanded: false, isDetached: true, restoreAsDetached: false } : t
      )
    );
  }, []);

  const attachTerminal = useCallback((containerId: string) => {
    setTerminals((prev) =>
      prev.map((t) =>
        t.containerId === containerId
          ? { ...t, isDetached: false, isExpanded: true, restoreAsDetached: false }
          : { ...t, isExpanded: false }
      )
    );
  }, []);

  const updateDetachedPos = useCallback((containerId: string, pos: DetachedPosition) => {
    setTerminals((prev) =>
      prev.map((t) =>
        t.containerId === containerId ? { ...t, detachedPos: pos } : t
      )
    );
  }, []);

  // Listen for postMessage status updates from iframes
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'terminal-status' && e.data.containerId && e.data.status) {
        setTerminals((prev) =>
          prev.map((t) =>
            t.containerId === e.data.containerId
              ? { ...t, status: e.data.status }
              : t
          )
        );
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Warn before unload if terminals are open
  useEffect(() => {
    if (terminals.length === 0) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [terminals.length]);

  return (
    <TerminalManagerContext.Provider
      value={{ terminals, openTerminal, openTerminalDetached, closeTerminal, expandTerminal, minimizeTerminal, detachTerminal, attachTerminal, updateDetachedPos }}
    >
      {children}
    </TerminalManagerContext.Provider>
  );
}
