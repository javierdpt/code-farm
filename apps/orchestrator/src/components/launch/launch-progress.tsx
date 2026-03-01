'use client';

import Link from 'next/link';

export type StepStatus = 'pending' | 'active' | 'success' | 'error';

export interface LaunchStep {
  label: string;
  detail?: string;
  status: StepStatus;
}

interface LaunchProgressProps {
  steps: LaunchStep[];
  containerId?: string;
  error?: string;
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'pending':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-vsc-border text-vsc-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-vsc-text-secondary" />
        </span>
      );
    case 'active':
      return (
        <span className="flex h-5 w-5 items-center justify-center">
          <svg className="h-5 w-5 animate-spin text-vsc-accent-blue" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" opacity="0.3" />
            <path d="M18 10A8 8 0 0 0 10 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      );
    case 'success':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-vsc-success text-white">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 6L5 8L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    case 'error':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-vsc-error text-white">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      );
  }
}

export function LaunchProgress({ steps, containerId, error }: LaunchProgressProps) {
  const allDone = steps.every((s) => s.status === 'success');

  return (
    <div className="space-y-4 rounded border border-vsc-border bg-vsc-bg-secondary p-4">
      <h3 className="text-sm font-medium text-vsc-text-primary">Launch Progress</h3>

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <StepIcon status={step.status} />
            <div className="flex-1">
              <p
                className={`text-sm ${
                  step.status === 'active'
                    ? 'text-vsc-accent-blue'
                    : step.status === 'success'
                      ? 'text-vsc-text-primary'
                      : step.status === 'error'
                        ? 'text-vsc-error'
                        : 'text-vsc-text-secondary'
                }`}
              >
                {step.label}
              </p>
              {step.detail && (
                <p className="mt-0.5 text-xs text-vsc-text-secondary">{step.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Error Message */}
      {error && (
        <div className="rounded border border-vsc-error/30 bg-vsc-error/10 px-3 py-2 text-sm text-vsc-error">
          {error}
        </div>
      )}

      {/* Success: link to container */}
      {allDone && containerId && (
        <div className="flex items-center gap-3 rounded border border-vsc-success/30 bg-vsc-success/10 px-3 py-2">
          <span className="text-sm text-vsc-success">Container is ready!</span>
          <Link
            href={`/containers/${containerId}`}
            className="rounded bg-vsc-accent-blue px-3 py-1 text-xs text-white transition-colors hover:bg-vsc-accent-blue/80"
          >
            Open Terminal
          </Link>
        </div>
      )}
    </div>
  );
}
