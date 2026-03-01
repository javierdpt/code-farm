import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateRequestId, createContainerCreate } from '@code-farm/shared';
import type { ContainerInfo } from '@code-farm/shared';
import { workerRegistry } from '@/lib/worker-registry';
import { wsState } from '@/lib/ws-state';

const LaunchBodySchema = z.object({
  ticketUrl: z.string().url(),
  workerName: z.string().min(1).optional(),
  extraInstructions: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = LaunchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { ticketUrl, workerName, extraInstructions } = parsed.data;

  // Step 1: Resolve ticket provider and fetch ticket data
  let ticket;
  try {
    // Dynamic import to handle the case where the package may not be fully built yet
    const { resolveProvider } = await import('@code-farm/ticket-providers');
    const provider = resolveProvider(ticketUrl);
    if (!provider) {
      return NextResponse.json(
        { error: `No ticket provider found for URL: ${ticketUrl}` },
        { status: 400 },
      );
    }
    ticket = await provider.fetch(ticketUrl);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch ticket: ${errorMessage}` },
      { status: 500 },
    );
  }

  // Step 2: Generate CLAUDE.md
  let claudeMd: string;
  try {
    const { generateClaudeMd } = await import('@code-farm/claude-md-generator');
    claudeMd = generateClaudeMd(ticket, { extraInstructions });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate CLAUDE.md: ${errorMessage}` },
      { status: 500 },
    );
  }

  // Step 3: Find target worker
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

  // Step 4: Create container on worker
  const requestId = generateRequestId();
  const branchName = ticket.branch || `ticket/${ticket.id}`;
  const config = {
    ticketUrl: ticket.url,
    ticketTitle: ticket.title,
    repoUrl: ticket.repoUrl,
    branch: branchName,
    workerName: worker.name,
  };

  const message = createContainerCreate(requestId, config);

  let container: ContainerInfo;
  try {
    const result = await wsState.sendRequest(worker.id, { ...message, requestId }, 60000);
    container = result as ContainerInfo;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create container: ${errorMessage}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      container,
      ticket: {
        provider: ticket.provider,
        url: ticket.url,
        id: ticket.id,
        title: ticket.title,
        repoUrl: ticket.repoUrl,
        branch: branchName,
      },
      claudeMd,
    },
    { status: 201 },
  );
}
