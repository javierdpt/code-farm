import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const contentDir = join(process.cwd(), 'public/content');

  // Find the file case-insensitively
  const files = await readdir(contentDir);
  const match = files.find((f) => f.toLowerCase() === `${slug.toLowerCase()}.md`);

  if (!match) {
    return new Response('Not found', { status: 404 });
  }

  const content = await readFile(join(contentDir, match), 'utf-8');
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
