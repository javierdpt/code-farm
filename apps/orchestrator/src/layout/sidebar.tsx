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

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse on mobile
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setCollapsed(e.matches);
    };
    handleChange(mq);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  return (
    <aside
      className={`relative flex flex-col border-r border-vsc-border bg-vsc-bg-secondary/90 transition-all duration-200 ${
        collapsed ? 'w-[60px]' : 'w-[240px]'
      }`}
    >
      {/* Navigation at the top */}
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

      {/* Logo at the bottom */}
      <div className={`flex items-center justify-center ${collapsed ? 'px-2 pb-10' : 'p-1 pb-10'}`}>
        {!collapsed && (
          <Image
            src="/images/logo.png"
            alt="Code Farm"
            width={200}
            height={200}
            className="h-auto w-full object-contain"
            priority
          />
        )}
        {collapsed && (
          <Image
            src="/images/logo-small.png"
            alt="Code Farm"
            width={40}
            height={40}
            className="h-auto w-full object-contain"
            priority
          />
        )}
      </div>

      {/* Collapse button — absolute positioned bottom-right */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`absolute bottom-2 flex h-7 w-7 items-center justify-center rounded text-vsc-text-secondary hover:bg-vsc-hover hover:text-vsc-text-primary transition-colors ${collapsed ? 'left-1/2 -translate-x-1/2' : 'right-2'}`}
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
    </aside>
  );
}
