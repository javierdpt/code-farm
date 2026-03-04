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
      <div className="mx-auto max-w-4xl overflow-x-hidden">
        <div className="prose-vsc overflow-x-hidden break-words">
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
      </div>
    </AppShell>
  );
}
