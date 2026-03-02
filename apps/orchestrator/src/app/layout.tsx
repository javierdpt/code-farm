import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
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
        <link rel="preload" href="/fonts/JetBrainsMonoNerdFont-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body className="bg-vsc-bg-primary text-vsc-text-primary font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
