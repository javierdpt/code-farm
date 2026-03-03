'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/layout/app-shell';
import { WorkerList } from '@/features/dashboard/worker-list';
import { SearchInput } from '@/common/search-input';
import { matchesSearch } from '@/core/search';
import type { WorkerInfo, ContainerInfo } from '@/core/types';

const POLL_INTERVAL = 5000;

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [containerCount, setContainerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
        const containers: ContainerInfo[] = data.containers ?? [];
        setContainerCount(containers.length);
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

  const filtered = useMemo(
    () => workers.filter((w) => matchesSearch(search, [w.name, w.hostname, w.platform, w.status])),
    [workers, search],
  );

  return (
    <AppShell
      title="Workers"
      workerCount={workers.length}
      containerCount={containerCount}
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
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-vsc-text-primary">
              All Workers
              <span className="ml-2 text-xs font-normal text-vsc-text-secondary">
                ({filtered.length})
              </span>
            </h2>
            {workers.length > 1 && (
              <SearchInput value={search} onChange={setSearch} className="w-64" />
            )}
          </div>
          <WorkerList workers={filtered} />
        </div>
      )}
    </AppShell>
  );
}
