'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type State = 'idle' | 'loading' | 'completing';

export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<State>('idle');
  const prevPathname = useRef(pathname);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      // Fill the bar fully, then fade out after a short delay
      setState('completing');
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setState('idle'), 500);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (
        !href ||
        href.startsWith('http') ||
        href.startsWith('#') ||
        href === pathname
      )
        return;
      setState('loading');
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pathname]);

  if (state === 'idle') return null;

  if (state === 'completing') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] overflow-hidden">
        <div
          className="h-full w-full"
          style={{
            background: 'linear-gradient(90deg, #D4A017, #3CB371, #4682B4)',
            animation: 'nav-complete 500ms ease-out forwards',
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] overflow-hidden">
      {/* Primary bar */}
      <div
        className="absolute inset-y-0 rounded-full"
        style={{
          background: 'linear-gradient(90deg, #D4A017, #3CB371, #4682B4)',
          animation:
            'nav-bar-1 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite',
        }}
      />
      {/* Secondary bar */}
      <div
        className="absolute inset-y-0 rounded-full"
        style={{
          background: 'linear-gradient(90deg, #4682B4, #3CB371, #D4A017)',
          animation:
            'nav-bar-2 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite',
        }}
      />
    </div>
  );
}
