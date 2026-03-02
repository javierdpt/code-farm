'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface SidebarProps {
  workerCount?: number;
}

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

export function Sidebar({ workerCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col border-r border-vsc-border bg-vsc-bg-secondary transition-all duration-200 ${
        collapsed ? 'w-[60px]' : 'w-[240px]'
      }`}
    >
      {/* Logo / Title */}
      <div className="flex h-12 items-center justify-between border-b border-vsc-border px-3">
        {!collapsed && (
          <span className="text-sm font-semibold text-vsc-accent-blue tracking-wide">
            Code Farm
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-7 w-7 items-center justify-center rounded text-vsc-text-secondary hover:bg-vsc-hover hover:text-vsc-text-primary transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
          >
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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

      {/* Worker Count Badge */}
      <div className="border-t border-vsc-border px-3 py-3">
        <div
          className={`flex items-center gap-2 text-xs text-vsc-text-secondary ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-vsc-success flex-shrink-0" />
          {!collapsed && <span>{workerCount} worker{workerCount !== 1 ? 's' : ''}</span>}
        </div>
      </div>
    </aside>
  );
}
