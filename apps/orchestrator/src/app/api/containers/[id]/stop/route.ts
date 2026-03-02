import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId, createContainerStop } from '@code-farm/shared';
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

  if (container.status !== 'running') {
    return NextResponse.json(
      { error: `Container is not running (status: ${container.status})` },
      { status: 409 },
    );
  }

  const requestId = generateRequestId();
  const message = createContainerStop(requestId, id);

  try {
    await wsState.sendRequest(container.workerId, { ...message, requestId }, 30000);
    return NextResponse.json({ success: true, containerId: id });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to stop container: ${errorMessage}` },
      { status: 500 },
    );
  }
}
