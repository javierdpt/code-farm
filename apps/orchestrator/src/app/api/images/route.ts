import { NextResponse } from 'next/server';
import { generateRequestId } from '@code-farm/shared';
import { workerRegistry } from '@/core/worker-registry';
import { wsState } from '@/core/ws-state';

export async function GET() {
  const worker = workerRegistry.getLeastLoaded();
  if (!worker) {
    return NextResponse.json({ images: [] });
  }

  const requestId = generateRequestId();
  const message = { type: 'images.list' as const, requestId };

  try {
    const images = await wsState.sendRequest(worker.id, message, 15000);
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
