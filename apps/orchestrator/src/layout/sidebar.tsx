'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: 'Launch',
    href: '/launch',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 3L17 17H3L10 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Build',
    href: '/build',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.5 2.5L12.5 5.5L15.5 4.5L13.5 7.5L16.5 9L13.5 9.5L14.5 12.5L12 10.5L10 13.5L9.5 10.5L6.5 11.5L8.5 8.5L5.5 7L8.5 6L7.5 3L10 5L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M4 14L2 18L6 16L4 14Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Workers',
    href: '/workers',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 17C4 13.6863 6.68629 11 10 11C13.3137 11 16 13.6863 16 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Containers',
    href: '/containers',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="12" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="6" cy="5.5" r="1" fill="currentColor" />
        <circle cx="6" cy="14.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Setup',
    href: '/docs',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 2H14C15.1 2 16 2.9 16 4V16C16 17.1 15.1 18 14 18H6C4.9 18 4 17.1 4 16V4C4 2.9 4.9 2 6 2Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 6H13M7 10H13M7 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

// Persist sidebar state across navigations (module-level so it survives remounts)
let sidebarUserCollapsed: boolean | null = null;

export function Sidebar() {
  const pathname = usePathname();
  // Default to expanded (false) on SSR so the sidebar renders at full width immediately.
  // useEffect will correct this on narrow viewports after hydration (no transition).
  const [collapsed, setCollapsed] = useState<boolean>(() => sidebarUserCollapsed ?? false);
  const [enableTransition, setEnableTransition] = useState(sidebarUserCollapsed !== null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (sidebarUserCollapsed === null) {
      const isNarrow = window.matchMedia('(max-width: 1024px)').matches;
      sidebarUserCollapsed = isNarrow;
      setCollapsed(isNarrow);
      // Enable transitions after the correct width has been painted
      requestAnimationFrame(() => setEnableTransition(true));
    } else {
      setEnableTransition(true);
    }

    const mq = window.matchMedia('(max-width: 1024px)');
    const handleChange = (e: MediaQueryListEvent) => {
      sidebarUserCollapsed = e.matches;
      setCollapsed(e.matches);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  return (
    <aside
      className={`hidden flex-col border-r border-vsc-border bg-vsc-bg-secondary/90 md:flex ${
        enableTransition ? 'transition-all duration-200' : ''
      } ${collapsed ? 'w-[60px]' : 'w-[240px]'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header: logo + collapse button */}
      <div className={`flex h-12 items-center border-b border-vsc-border px-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed ? (
          <>
            <Image
              src="/images/logo-small-with-text.png"
              alt="Code Farm"
              width={160}
              height={44}
              className="w-auto"
              priority
              style={{position: 'relative', height: 38, left: -6}}
            />
            <button
              onClick={() => { sidebarUserCollapsed = true; setCollapsed(true); }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-vsc-text-secondary hover:bg-vsc-hover hover:text-vsc-text-primary transition-colors"
              aria-label="Collapse sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        ) : hovered ? (
          <button
            onClick={() => { sidebarUserCollapsed = false; setCollapsed(false); }}
            className="flex h-7 w-7 items-center justify-center rounded text-vsc-text-secondary hover:bg-vsc-hover hover:text-vsc-text-primary transition-colors"
            aria-label="Expand sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="rotate-180">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <Image
            src="/images/logo-small.png"
            alt="Code Farm"
            width={32}
            height={32}
            className="h-7 w-7 object-contain"
            priority
            style={{height: 48, width: 48}}
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded px-2 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-vsc-active text-white'
                      : 'text-vsc-text-secondary hover:bg-vsc-hover hover:text-vsc-text-primary'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

/** Bottom navigation bar for mobile viewports */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-[52px] shrink-0 border-t border-vsc-border bg-vsc-bg-secondary/95 md:hidden">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
              isActive
                ? 'text-vsc-accent-blue'
                : 'text-vsc-text-secondary'
            }`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
