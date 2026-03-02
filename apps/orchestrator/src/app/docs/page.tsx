'use client';

import { AppShell } from '@/layout/app-shell';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useState } from 'react';

export default function DocsPage() {
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch('/api/docs')
      .then((res) => res.text())
      .then(setContent);
  }, []);

  return (
    <AppShell title="Setup" breadcrumb={['Setup Guide']}>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="prose-vsc">
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
      </div>
    </AppShell>
  );
}
