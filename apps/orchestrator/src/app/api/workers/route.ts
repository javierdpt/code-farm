import { NextResponse } from 'next/server';
import { workerRegistry } from '@/core/worker-registry';

export async function GET() {
  const workers = workerRegistry.getAll();
  return NextResponse.json({ workers });
}
