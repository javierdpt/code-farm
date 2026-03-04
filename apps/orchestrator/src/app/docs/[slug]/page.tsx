'use client';

import { AppShell } from '@/layout/app-shell';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface DocPage {
  slug: string;
  title: string;
}

export default function DocSlugPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [content, setContent] = useState('');
  const [pages, setPages] = useState<DocPage[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const currentPage = pages.find((p) => p.slug === slug);
  const title = currentPage?.title ?? slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    fetch('/api/docs/pages')
      .then((res) => res.json())
      .then((data) => setPages(data.pages ?? []));
  }, []);

  useEffect(() => {
    fetch(`/api/docs/${slug}`)
      .then((res) => {
        if (!res.ok) {
          router.replace('/docs/about');
          return '';
        }
        return res.text();
      })
      .then(setContent);
  }, [slug, router]);

  return (
    <AppShell title="Docs" breadcrumb={['Docs', title]}>
      <div className="mx-auto max-w-4xl overflow-x-hidden">
        {/* Page selector */}
        <div className="mb-6 flex items-center gap-2">
          {/* Desktop: tab-style links */}
          <div className="hidden items-center gap-1 rounded-lg border border-vsc-border bg-vsc-bg-secondary p-1 md:flex">
            {pages.map((page) => (
              <Link
                key={page.slug}
                href={`/docs/${page.slug}`}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  page.slug === slug
                    ? 'bg-vsc-active text-white'
                    : 'text-vsc-text-secondary hover:bg-vsc-hover hover:text-vsc-text-primary'
                }`}
              >
                {page.title}
              </Link>
            ))}
          </div>

          {/* Mobile: dropdown menu */}
          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg border border-vsc-border bg-vsc-bg-secondary px-3 py-2 text-sm text-vsc-text-primary"
            >
              {title}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              >
                <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-vsc-border bg-vsc-bg-secondary py-1 shadow-lg">
                  {pages.map((page) => (
                    <Link
                      key={page.slug}
                      href={`/docs/${page.slug}`}
                      onClick={() => setMenuOpen(false)}
                      className={`block px-3 py-2 text-sm transition-colors ${
                        page.slug === slug
                          ? 'bg-vsc-active text-white'
                          : 'text-vsc-text-secondary hover:bg-vsc-hover hover:text-vsc-text-primary'
                      }`}
                    >
                      {page.title}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Markdown content */}
        <div className="prose-vsc overflow-x-hidden break-words">
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
      </div>
    </AppShell>
  );
}
