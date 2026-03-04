'use client';

import { useState, type ReactNode } from 'react';

interface StatusFooterProps {
  /** Items rendered on the left side */
  left: ReactNode;
  /** Items rendered on the right side (desktop always visible, mobile expandable) */
  right: ReactNode;
  /** Compact summary shown on mobile when collapsed (e.g. connection dot) */
  rightCollapsed?: ReactNode;
}

export function StatusFooter({ left, right, rightCollapsed }: StatusFooterProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer className="shrink-0 bg-vsc-status-bar text-xs text-white pb-[env(safe-area-inset-bottom)]">
      {/* Main row */}
      <div className="hidden h-6 items-center justify-between px-3 md:flex">
        <div className="hidden items-center gap-3 md:flex">{left}</div>

        {/* Desktop: show right items inline */}
        <div className="hidden items-center gap-4 md:flex">{right}</div>
      </div>

      {/* Mobile: tappable full-width bar */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex h-10 w-full items-center justify-between px-4 active:bg-white/10 md:hidden"
        aria-label="Toggle status details"
      >
        <div className="flex items-center gap-3">{left}</div>
        <div className="flex items-center gap-2">
          {rightCollapsed}
          <svg
            width="12"
            height="12"
            viewBox="0 0 10 10"
            fill="none"
            className={`transition-transform duration-150 ${!expanded ? '' : 'rotate-180'}`}
          >
            <path d="M2 6L5 3L8 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Mobile expanded row */}
      {expanded && (
        <div className="flex items-center justify-around border-t border-white/10 px-4 py-2 md:hidden">
          {right}
        </div>
      )}
    </footer>
  );
}
