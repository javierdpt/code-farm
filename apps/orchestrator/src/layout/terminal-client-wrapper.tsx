'use client';

import type { ReactNode } from 'react';
import { TerminalManagerProvider } from '@/features/terminal/terminal-manager';
import { TerminalIframeLayer } from '@/features/terminal/terminal-iframe-layer';

export function TerminalClientWrapper({ children }: { children: ReactNode }) {
  return (
    <TerminalManagerProvider>
      {children}
      <TerminalIframeLayer />
    </TerminalManagerProvider>
  );
}
