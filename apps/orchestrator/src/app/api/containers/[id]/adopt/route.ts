import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { wsState } from '@/core/ws-state';

const AdoptBodySchema = z.object({
  ticketUrl: z.string().url().optional().default(''),
  ticketTitle: z.string().optional().default(''),
  repoUrl: z.string().url().optional().default(''),
  branch: z.string().optional().default(''),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const container = wsState.containers.get(id);

  if (!container) {
    return NextResponse.json({ error: 'Container not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = AdoptBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 },
    );
  }

  // Update the container metadata in orchestrator state
  const updated = {
    ...container,
    ...parsed.data,
    managed: true,
  };
  wsState.containers.set(id, updated);

  return NextResponse.json({ container: updated });
}
