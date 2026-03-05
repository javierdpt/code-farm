import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function GET() {
  const contentDir = join(process.cwd(), 'public/content');
  const files = await readdir(contentDir);
  const pages = files
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.replace(/\.md$/, '').toLowerCase();
      const title = f.replace(/\.md$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return { slug, title };
    })
    .sort((a, b) => {
      // About first, then alphabetical
      if (a.slug === 'about') return -1;
      if (b.slug === 'about') return 1;
      return a.title.localeCompare(b.title);
    });

  return Response.json({ pages });
}
