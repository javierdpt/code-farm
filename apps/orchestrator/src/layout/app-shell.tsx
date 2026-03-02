'use client';

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
  workerCount = 0,
  containerCount = 0,
  connected = false,
}: AppShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar workerCount={workerCount} />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header title={title} breadcrumb={breadcrumb} workerCount={workerCount} />

          <main className="flex-1 overflow-auto p-6">
            {children}
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
