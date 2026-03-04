'use client';

import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';

export interface TerminalSession {
  id: string;
  containerId: string;
  workerId: string;
  containerName: string;
  workerName: string;
  status: 'connecting' | 'connected' | 'disconnected';
  isExpanded: boolean;
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
  closeTerminal: (containerId: string) => void;
  expandTerminal: (containerId: string) => void;
  minimizeTerminal: (containerId: string) => void;
}

const TerminalManagerContext = createContext<TerminalManagerContextValue | null>(null);

export function useTerminalManager() {
  const ctx = useContext(TerminalManagerContext);
  if (!ctx) throw new Error('useTerminalManager must be used within TerminalManagerProvider');
  return ctx;
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
          id: crypto.randomUUID(),
          containerId: info.containerId,
          workerId: info.workerId,
          containerName: info.containerName,
          workerName: info.workerName,
          status: 'connecting',
          isExpanded: true,
        },
      ];
    });
  }, []);

  const closeTerminal = useCallback((containerId: string) => {
    setTerminals((prev) => prev.filter((t) => t.containerId !== containerId));
  }, []);

  const expandTerminal = useCallback((containerId: string) => {
    setTerminals((prev) =>
      prev.map((t) => ({
        ...t,
        isExpanded: t.containerId === containerId,
      }))
    );
  }, []);

  const minimizeTerminal = useCallback((containerId: string) => {
    setTerminals((prev) =>
      prev.map((t) =>
        t.containerId === containerId ? { ...t, isExpanded: false } : t
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
      value={{ terminals, openTerminal, closeTerminal, expandTerminal, minimizeTerminal }}
    >
      {children}
    </TerminalManagerContext.Provider>
  );
}
