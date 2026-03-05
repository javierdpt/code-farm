import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { NavigationProgress } from '@/layout/navigation-progress';
import { TerminalClientWrapper } from '@/layout/terminal-client-wrapper';
import './globals.css';

const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Code Farm',
  description: 'Orchestrate Claude Code development containers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} dark`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#252526" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#252526" media="(prefers-color-scheme: dark)" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preload" href="/fonts/JetBrainsMonoNerdFont-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body className="bg-vsc-bg-secondary text-vsc-text-primary font-mono antialiased overflow-hidden h-dvh">
        <TerminalClientWrapper>
          <NavigationProgress />
          {children}
        </TerminalClientWrapper>
      </body>
    </html>
  );
}
