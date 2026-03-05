'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar, BottomNav } from '@/layout/sidebar';
import { Header } from '@/layout/header';
import { StatusBar } from '@/layout/status-bar';
import { OpsLogProvider } from '@/features/ops-log/ops-log-provider';
import { OpsLogPanel } from '@/features/ops-log/ops-log-panel';
import { TerminalTabBar } from '@/features/terminal/terminal-tab-bar';

// Module-level cache so remounts across navigations don't flash zeros
let cachedWorkerCount = 0;
let cachedContainerCount = 0;
let cachedConnected = false;

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
  const [selfWorkerCount, setSelfWorkerCount] = useState(cachedWorkerCount);
  const [selfContainerCount, setSelfContainerCount] = useState(cachedContainerCount);
  const [selfConnected, setSelfConnected] = useState(cachedConnected);

  const fetchCounts = useCallback(async () => {
    try {
      const [workersRes, containersRes] = await Promise.all([
        fetch('/api/workers'),
        fetch('/api/containers'),
      ]);
      if (workersRes.ok) {
        const data = await workersRes.json();
        const online = (data.workers ?? []).filter((w: { status: string }) => w.status === 'online');
        cachedWorkerCount = online.length;
        cachedConnected = online.length > 0;
        setSelfWorkerCount(online.length);
        setSelfConnected(online.length > 0);
      }
      if (containersRes.ok) {
        const data = await containersRes.json();
        cachedContainerCount = (data.containers ?? []).length;
        setSelfContainerCount(cachedContainerCount);
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
    <OpsLogProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header title={title} breadcrumb={breadcrumb} workerCount={workerCount} />

            <main
              className="relative flex flex-1 flex-col overflow-auto"
              style={{
                backgroundImage:
                  'linear-gradient(rgb(30 30 30 / 0.93), rgb(30 30 30 / 0.93)), url(/images/logo.png)',
                backgroundAttachment: 'local, fixed',
                backgroundPosition: 'center, center',
                backgroundRepeat: 'repeat, no-repeat',
                backgroundSize: 'auto, contain',
              }}
            >
              <div className="flex-1 p-6">
                {children}
              </div>
            </main>
          </div>
        </div>

        {/* Floating Ops Log Panel */}
        <OpsLogPanel />

        {/* Minimized Terminal Tabs */}
        <TerminalTabBar />

        {/* Mobile Bottom Navigation */}
        <BottomNav />

        {/* Status Bar */}
        <StatusBar
          connected={connected}
          workerCount={workerCount}
          containerCount={containerCount}
        />
      </div>
    </OpsLogProvider>
  );
}
