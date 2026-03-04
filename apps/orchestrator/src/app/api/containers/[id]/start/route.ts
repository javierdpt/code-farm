import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId, createContainerStart } from '@javierdpt/code-farm-shared';
import type { ContainerInfo } from '@javierdpt/code-farm-shared';
import { wsState } from '@/core/ws-state';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const container = wsState.containers.get(id);

  if (!container) {
    return NextResponse.json({ error: 'Container not found' }, { status: 404 });
  }

  if (container.status === 'running') {
    return NextResponse.json(
      { error: 'Container is already running' },
      { status: 409 },
    );
  }

  if (container.status === 'removing') {
    return NextResponse.json(
      { error: 'Container is being removed' },
      { status: 409 },
    );
  }

  const requestId = generateRequestId();
  const message = createContainerStart(requestId, id);

  try {
    const result = await wsState.sendRequest(container.workerId, { ...message, requestId }, 30000);
    const updated = result as ContainerInfo;
    return NextResponse.json({ container: updated });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to start container: ${errorMessage}` },
      { status: 500 },
    );
  }
}
