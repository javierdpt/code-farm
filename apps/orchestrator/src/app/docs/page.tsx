'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DocsIndex() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the default docs page
    router.replace('/docs/about');
  }, [router]);

  return null;
}
