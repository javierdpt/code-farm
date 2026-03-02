'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { TerminalFullscreen } from '@/features/terminal/terminal-fullscreen';
import type { ContainerInfo } from '@/core/types';

export default function FullscreenTerminalPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const containerId = params.id;
  const workerId = searchParams.get('worker') ?? '';

  const [container, setContainer] = useState<ContainerInfo | null>(null);
  const [workerCount, setWorkerCount] = useState(0);
  const [containerCount, setContainerCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [containerRes, workersRes, containersRes] = await Promise.all([
          fetch(`/api/containers/${containerId}`),
          fetch('/api/workers'),
          fetch('/api/containers'),
        ]);
        if (containerRes.ok) {
          const data = await containerRes.json();
          setContainer(data.container);
        }
        if (workersRes.ok) {
          const data = await workersRes.json();
          const online = (data.workers ?? []).filter((w: { status: string }) => w.status === 'online');
          setWorkerCount(online.length);
        }
        if (containersRes.ok) {
          const data = await containersRes.json();
          setContainerCount((data.containers ?? []).length);
        }
      } catch {
        // ignore
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [containerId]);

  const handleExit = useCallback(() => {
    router.push(`/containers/${containerId}`);
  }, [router, containerId]);

  if (!workerId) {
    return (
      <div className="flex h-screen items-center justify-center bg-vsc-bg-primary">
        <div className="text-center">
          <p className="text-sm text-vsc-error">Missing worker ID in URL parameters.</p>
          <button
            type="button"
            onClick={() => router.push(`/containers/${containerId}`)}
            className="mt-4 rounded bg-vsc-bg-tertiary px-4 py-2 text-sm text-vsc-text-primary transition-colors hover:bg-vsc-hover"
          >
            Back to Container
          </button>
        </div>
      </div>
    );
  }

  return (
    <TerminalFullscreen
      containerId={containerId}
      workerId={workerId}
      containerName={container?.name}
      workerName={container?.workerName}
      image={container?.image}
      onExit={handleExit}
      workerCount={workerCount}
      containerCount={containerCount}
    />
  );
}
