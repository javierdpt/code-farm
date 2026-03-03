import { NextRequest, NextResponse } from 'next/server';
import { workerRegistry } from '@/core/worker-registry';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const worker = workerRegistry.get(id);

  if (!worker) {
    return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
  }

  return NextResponse.json({ worker });
}
