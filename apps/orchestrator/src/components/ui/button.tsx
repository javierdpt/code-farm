'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-vsc-status-bar text-white hover:brightness-110 active:brightness-90',
  secondary:
    'bg-vsc-bg-tertiary text-vsc-text-primary border border-vsc-border hover:bg-vsc-hover active:bg-vsc-bg-input',
  danger:
    'bg-vsc-error text-white hover:brightness-110 active:brightness-90',
  ghost:
    'bg-transparent text-vsc-text-secondary hover:bg-vsc-hover hover:text-vsc-text-primary active:bg-vsc-bg-tertiary',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-1.5 text-sm',
  lg: 'px-5 py-2 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2 rounded font-medium
          transition-all duration-150 outline-none
          focus-visible:ring-2 focus-visible:ring-vsc-accent-blue focus-visible:ring-offset-1 focus-visible:ring-offset-vsc-bg-primary
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
          ${className}
        `.trim()}
        {...props}
      >
        {loading && (
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
            <path
              d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
