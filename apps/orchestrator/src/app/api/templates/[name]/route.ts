import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const containerfile = path.join(process.cwd(), 'containers', name, 'Containerfile');

  try {
    const dockerfile = fs.readFileSync(containerfile, 'utf-8');
    return NextResponse.json({ name, dockerfile });
  } catch {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }
}
