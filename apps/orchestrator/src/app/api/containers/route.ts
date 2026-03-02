import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateRequestId, createContainerCreate } from '@code-farm/shared';
import type { ContainerInfo } from '@code-farm/shared';
import { workerRegistry } from '@/core/worker-registry';
import { wsState } from '@/core/ws-state';

export async function GET() {
  const containers = Array.from(wsState.containers.values());
  return NextResponse.json({ containers });
}

const CreateContainerBodySchema = z.object({
  ticketUrl: z.string().url(),
  ticketTitle: z.string().min(1),
  repoUrl: z.string().url(),
  branch: z.string().min(1),
  workerName: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateContainerBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { ticketUrl, ticketTitle, repoUrl, branch, workerName, image } = parsed.data;

  // Find target worker
  let worker;
  if (workerName) {
    worker = workerRegistry.findByName(workerName);
    if (!worker) {
      return NextResponse.json(
        { error: `Worker "${workerName}" not found` },
        { status: 404 },
      );
    }
    if (worker.status !== 'online') {
      return NextResponse.json(
        { error: `Worker "${workerName}" is not online (status: ${worker.status})` },
        { status: 503 },
      );
    }
  } else {
    worker = workerRegistry.getLeastLoaded();
    if (!worker) {
      return NextResponse.json(
        { error: 'No online workers available' },
        { status: 503 },
      );
    }
  }

  // Build container create request
  const requestId = generateRequestId();
  const config = {
    ticketUrl,
    ticketTitle,
    repoUrl,
    branch,
    workerName: worker.name,
    ...(image ? { image } : {}),
  };

  const message = createContainerCreate(requestId, config);

  try {
    const result = await wsState.sendRequest(worker.id, { ...message, requestId }, 60000);
    const container = result as ContainerInfo;
    return NextResponse.json({ container }, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create container: ${errorMessage}` },
      { status: 500 },
    );
  }
}
