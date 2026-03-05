import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const containersDir = path.join(process.cwd(), 'containers');

  try {
    const entries = fs.readdirSync(containersDir, { withFileTypes: true });
    const templates = entries
      .filter(e => e.isDirectory())
      .filter(e => fs.existsSync(path.join(containersDir, e.name, 'Containerfile')))
      .map(e => ({ name: e.name, path: `containers/${e.name}` }));

    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}
