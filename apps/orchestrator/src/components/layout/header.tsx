'use client';

interface HeaderProps {
  title?: string;
  breadcrumb?: string[];
  workerCount?: number;
}

export function Header({ title = 'Dashboard', breadcrumb, workerCount = 0 }: HeaderProps) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-vsc-border bg-vsc-bg-secondary px-4">
      {/* Left: Title + Breadcrumb */}
      <div className="flex items-center gap-2">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-vsc-text-secondary">
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

      {/* Right: Worker Status */}
      <div className="flex items-center gap-2 text-xs text-vsc-text-secondary">
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
