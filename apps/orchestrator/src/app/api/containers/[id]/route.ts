import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId, createContainerRemove } from '@javierdpt/code-farm-shared';
import { wsState } from '@/core/ws-state';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const container = wsState.containers.get(id);

  if (!container) {
    return NextResponse.json({ error: 'Container not found' }, { status: 404 });
  }

  return NextResponse.json({ container });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const container = wsState.containers.get(id);

  if (!container) {
    return NextResponse.json({ error: 'Container not found' }, { status: 404 });
  }

  const requestId = generateRequestId();
  const message = createContainerRemove(requestId, id);

  try {
    await wsState.sendRequest(container.workerId, { ...message, requestId }, 30000);
    return NextResponse.json({ success: true, containerId: id });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to remove container: ${errorMessage}` },
      { status: 500 },
    );
  }
}
