'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { TerminalFullscreen } from '@/features/terminal/terminal-fullscreen';

export default function FullscreenTerminalPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const containerId = params.id;
  const workerId = searchParams.get('worker') ?? '';

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
      onExit={handleExit}
    />
  );
}
