'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/layout/app-shell';
import { WorkerList } from '@/features/dashboard/worker-list';
import { ContainerList } from '@/features/containers/container-list';
import { SearchInput } from '@/common/search-input';
import { matchesSearch } from '@/core/search';
import type { WorkerInfo, ContainerInfo } from '@/core/types';

const POLL_INTERVAL = 5000;

export default function DashboardPage() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [workerSearch, setWorkerSearch] = useState('');
  const [containerSearch, setContainerSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [workersRes, containersRes] = await Promise.all([
        fetch('/api/workers'),
        fetch('/api/containers'),
      ]);

      if (workersRes.ok) {
        const data = await workersRes.json();
        setWorkers(data.workers ?? []);
      }

      if (containersRes.ok) {
        const data = await containersRes.json();
        setContainers(data.containers ?? []);
      }
    } catch {
      // Silently fail on network errors; data stays stale
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredWorkers = useMemo(
    () => workers.filter((w) => matchesSearch(workerSearch, [w.name, w.hostname, w.platform, w.status])),
    [workers, workerSearch],
  );

  const filteredContainers = useMemo(
    () => containers.filter((c) => matchesSearch(containerSearch, [c.name, c.id, c.image, c.status, c.workerName, c.ticketTitle])),
    [containers, containerSearch],
  );

  return (
    <AppShell
      title="Dashboard"
      workerCount={workers.length}
      containerCount={containers.length}
      connected={workers.length > 0}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="h-8 w-8 animate-spin text-vsc-accent-blue" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
            <path d="M22 12A10 10 0 0 0 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Workers Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-vsc-text-primary">
                Workers
                <span className="ml-2 text-xs font-normal text-vsc-text-secondary">
                  ({filteredWorkers.length})
                </span>
              </h2>
              {workers.length > 1 && (
                <SearchInput value={workerSearch} onChange={setWorkerSearch} className="w-64" />
              )}
            </div>
            <WorkerList workers={filteredWorkers} />
          </section>

          {/* Containers Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-vsc-text-primary">
                Containers
                <span className="ml-2 text-xs font-normal text-vsc-text-secondary">
                  ({filteredContainers.length})
                </span>
              </h2>
              {containers.length > 1 && (
                <SearchInput value={containerSearch} onChange={setContainerSearch} className="w-64" />
              )}
            </div>
            <ContainerList containers={filteredContainers} />
          </section>
        </div>
      )}
    </AppShell>
  );
}
