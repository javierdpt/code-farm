'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ContainerList } from '@/components/containers/container-list';
import type { ContainerInfo, WorkerInfo } from '@/types';

const POLL_INTERVAL = 5000;

export default function ContainersPage() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [workerCount, setWorkerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [containersRes, workersRes] = await Promise.all([
        fetch('/api/containers'),
        fetch('/api/workers'),
      ]);

      if (containersRes.ok) {
        const data = await containersRes.json();
        setContainers(data.containers ?? []);
      }

      if (workersRes.ok) {
        const data = await workersRes.json();
        const workers: WorkerInfo[] = data.workers ?? [];
        setWorkerCount(workers.filter((w) => w.status === 'online').length);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <AppShell
      title="Containers"
      workerCount={workerCount}
      containerCount={containers.length}
      connected={workerCount > 0}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="h-8 w-8 animate-spin text-vsc-accent-blue" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
            <path d="M22 12A10 10 0 0 0 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-vsc-text-primary">
              All Containers
              <span className="ml-2 text-xs font-normal text-vsc-text-secondary">
                ({containers.length})
              </span>
            </h2>
          </div>
          <ContainerList containers={containers} />
        </div>
      )}
    </AppShell>
  );
}
