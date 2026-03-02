'use client';

import { type InputHTMLAttributes, forwardRef, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, className = '', ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-vsc-text-secondary">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full rounded border border-vsc-border bg-vsc-bg-input px-3 py-1.5 text-sm
            text-vsc-text-primary placeholder-vsc-text-secondary
            outline-none transition-colors
            focus:border-vsc-accent-blue focus:ring-1 focus:ring-vsc-accent-blue
            disabled:cursor-not-allowed disabled:opacity-50
            ${icon ? 'pl-9' : ''}
            ${className}
          `.trim()}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
