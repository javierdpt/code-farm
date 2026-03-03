'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';

export interface OpsLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  command?: string;
  workerId: string;
  workerName?: string;
}

interface OpsLogContextValue {
  logs: OpsLogEntry[];
  unreadCount: number;
  clearUnread: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const OpsLogContext = createContext<OpsLogContextValue | null>(null);

export function useOpsLog() {
  const ctx = useContext(OpsLogContext);
  if (!ctx) throw new Error('useOpsLog must be used within OpsLogProvider');
  return ctx;
}

const MAX_LOGS = 500;

export function OpsLogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<OpsLogEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);

  // Keep ref in sync so the SSE callback can read the latest value
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // When panel opens, clear unread
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // SSE connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      eventSource = new EventSource('/api/ops/stream');

      eventSource.onmessage = (event) => {
        try {
          const entry: OpsLogEntry = JSON.parse(event.data);
          setLogs((prev) => {
            const next = [...prev, entry];
            if (next.length > MAX_LOGS) {
              return next.slice(-MAX_LOGS);
            }
            return next;
          });
          // Increment unread count when panel is closed
          if (!isOpenRef.current) {
            setUnreadCount((prev) => prev + 1);
          }
        } catch {
          // Ignore malformed data
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Reconnect after a delay
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return (
    <OpsLogContext.Provider value={{ logs, unreadCount, clearUnread, isOpen, setIsOpen }}>
      {children}
    </OpsLogContext.Provider>
  );
}
