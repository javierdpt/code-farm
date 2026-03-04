import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateRequestId, createContainerCreate } from '@code-farm/shared';
import type { ContainerInfo } from '@code-farm/shared';
import { workerRegistry } from '@/core/worker-registry';
import { wsState } from '@/core/ws-state';

const PodmanArgSchema = z.object({
  flag: z.string().min(1),
  value: z.string().min(1),
});

const LaunchBodySchema = z.object({
  ticketUrl: z.string().url().optional(),
  repoUrl: z.string().url().optional(),
  branch: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  workerName: z.string().min(1).optional(),
  extraInstructions: z.string().optional(),
  image: z.string().min(1).optional(),
  memoryMb: z.number().int().positive().optional(),
  token: z.string().optional(),
  podmanArgs: z.array(PodmanArgSchema).optional(),
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

  const { ticketUrl, repoUrl: manualRepoUrl, branch: manualBranch, workerName, extraInstructions, image, memoryMb, token, podmanArgs } = parsed.data;

  let ticket;
  let claudeMd: string | undefined;

  // Step 1 & 2: Fetch ticket and generate CLAUDE.md (only if ticketUrl provided)
  if (ticketUrl) {
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
      ticket = await provider.fetch(ticketUrl, { token });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to fetch ticket: ${errorMessage}` },
        { status: 500 },
      );
    }

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

  const config = ticket
    ? {
        ticketUrl: ticket.url,
        ticketTitle: ticket.title,
        repoUrl: manualRepoUrl || ticket.repoUrl,
        branch: manualBranch || ticket.branch || `feature/issue-${ticket.id}`,
        workerName: worker.name,
        ...(image ? { image } : {}),
        ...(memoryMb ? { memoryMb } : {}),
        ...(podmanArgs?.length ? { podmanArgs } : {}),
        ...(claudeMd ? { claudeMd } : {}),
        ...(token ? { gitToken: token } : {}),
      }
    : {
        ticketUrl: '',
        ticketTitle: '',
        repoUrl: manualRepoUrl || '',
        branch: manualBranch || '',
        workerName: worker.name,
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(image ? { image } : {}),
        ...(memoryMb ? { memoryMb } : {}),
        ...(podmanArgs?.length ? { podmanArgs } : {}),
        ...(token ? { gitToken: token } : {}),
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

  if (ticket) {
    const branchName = ticket.branch || `feature/issue-${ticket.id}`;
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

  return NextResponse.json(
    {
      container,
    },
    { status: 201 },
  );
}
