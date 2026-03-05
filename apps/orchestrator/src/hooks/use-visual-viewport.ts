'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Height to subtract from viewport when mobile keyboard is open.
 * Adjust this single value to match your target device.
 */
const MOBILE_KEYBOARD_HEIGHT = 220;

interface VisualViewportState {
  height: number;
  offsetTop: number;
  keyboardOpen: boolean;
}

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Simple mobile keyboard hook.
 * Desktop: returns null (use CSS 100dvh).
 * Mobile: on input focus, returns viewport height minus MOBILE_KEYBOARD_HEIGHT.
 */
export function useVisualViewport(): VisualViewportState | null {
  const [state, setState] = useState<VisualViewportState | null>(null);
  const focusedRef = useRef(false);
  const isMobileRef = useRef(false);

  useEffect(() => {
    isMobileRef.current = isTouchDevice();
    if (!isMobileRef.current) return; // Desktop — no hook needed

    const update = () => {
      const h = window.innerHeight;
      if (focusedRef.current) {
        setState({ height: h - MOBILE_KEYBOARD_HEIGHT, offsetTop: 0, keyboardOpen: true });
      } else {
        setState({ height: h, offsetTop: 0, keyboardOpen: false });
      }
      // Prevent iOS scroll push
      window.scrollTo(0, 0);
    };

    update();

    const onFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(e.target as HTMLElement)?.isContentEditable) return;
      focusedRef.current = true;
      setTimeout(update, 200);
    };

    const onFocusOut = () => {
      setTimeout(() => {
        const tag = document.activeElement?.tagName;
        const stillInput = tag === 'INPUT' || tag === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable;
        if (!stillInput) {
          focusedRef.current = false;
          update();
        }
      }, 300);
    };

    const onResize = () => update();

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', onResize);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return state;
}
