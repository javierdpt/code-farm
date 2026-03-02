'use client';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    'bg-vsc-bg-tertiary text-vsc-text-secondary border-vsc-border',
  success:
    'bg-vsc-success/15 text-vsc-success border-vsc-success/30',
  warning:
    'bg-vsc-warning/15 text-vsc-warning border-vsc-warning/30',
  error:
    'bg-vsc-error/15 text-vsc-error border-vsc-error/30',
  info:
    'bg-vsc-accent-blue/15 text-vsc-accent-blue border-vsc-accent-blue/30',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `.trim()}
    >
      {children}
    </span>
  );
}
