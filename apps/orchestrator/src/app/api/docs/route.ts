import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function GET() {
  const filePath = join(process.cwd(), 'src/content/setup.md');
  const content = await readFile(filePath, 'utf-8');
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
