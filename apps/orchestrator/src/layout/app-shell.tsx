'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/layout/sidebar';
import { Header } from '@/layout/header';
import { StatusBar } from '@/layout/status-bar';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  breadcrumb?: string[];
  workerCount?: number;
  containerCount?: number;
  connected?: boolean;
}

export function AppShell({
  children,
  title,
  breadcrumb,
  workerCount: workerCountProp,
  containerCount: containerCountProp,
  connected: connectedProp,
}: AppShellProps) {
  const [selfWorkerCount, setSelfWorkerCount] = useState(0);
  const [selfContainerCount, setSelfContainerCount] = useState(0);
  const [selfConnected, setSelfConnected] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const [workersRes, containersRes] = await Promise.all([
        fetch('/api/workers'),
        fetch('/api/containers'),
      ]);
      if (workersRes.ok) {
        const data = await workersRes.json();
        const online = (data.workers ?? []).filter((w: { status: string }) => w.status === 'online');
        setSelfWorkerCount(online.length);
        setSelfConnected(online.length > 0);
      }
      if (containersRes.ok) {
        const data = await containersRes.json();
        setSelfContainerCount((data.containers ?? []).length);
      }
    } catch {
      // ignore fetch errors
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 5000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  // Props override self-fetched values when provided
  const workerCount = workerCountProp ?? selfWorkerCount;
  const containerCount = containerCountProp ?? selfContainerCount;
  const connected = connectedProp ?? selfConnected;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header title={title} breadcrumb={breadcrumb} workerCount={workerCount} />

          <main className="relative flex flex-1 flex-col overflow-auto">
            {/* Watermark background logo */}
            <div
              className="pointer-events-none absolute inset-0 bg-center bg-no-repeat bg-contain"
              style={{ backgroundImage: 'url(/images/logo.png)', backgroundAttachment: 'fixed' }}
            />
            <div className="pointer-events-none absolute inset-0 bg-vsc-bg-primary/95" />

            <div className="relative z-10 flex-1 p-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        connected={connected}
        workerCount={workerCount}
        containerCount={containerCount}
      />
    </div>
  );
}
