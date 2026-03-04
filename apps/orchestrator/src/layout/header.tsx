'use client';

import Image from 'next/image';

interface HeaderProps {
  title?: string;
  breadcrumb?: string[];
  workerCount?: number;
}

export function Header({ title = 'Dashboard', breadcrumb, workerCount = 0 }: HeaderProps) {
  return (
    <header className="safe-area-top flex min-h-12 shrink-0 items-center justify-between border-b border-vsc-border bg-vsc-bg-secondary px-4">
      {/* Left: Logo (mobile) + Title + Breadcrumb */}
      <div className="flex items-center gap-2">
        <Image
          src="/images/logo-small.png"
          alt="Code Farm"
          width={24}
          height={24}
          className="h-6 w-6 object-contain md:hidden"
          style={{height: 48, width: 48}}
        />
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="hidden items-center gap-1 text-xs text-vsc-text-secondary md:flex">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="mx-1">/</span>}
                <span>{crumb}</span>
              </span>
            ))}
            <span className="mx-1">/</span>
          </nav>
        )}
        <h1 className="text-sm font-medium text-vsc-text-primary">{title}</h1>
      </div>

      {/* Right: Worker Status (hidden on mobile) */}
      <div className="hidden items-center gap-2 text-xs text-vsc-text-secondary md:flex">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            workerCount > 0 ? 'bg-vsc-success' : 'bg-vsc-error'
          }`}
        />
        <span>
          {workerCount} worker{workerCount !== 1 ? 's' : ''} online
        </span>
      </div>
    </header>
  );
}
