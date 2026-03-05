'use client';

import { useState, useCallback } from 'react';
import { loadConnections, providerKey } from './connection-config-dialog';

interface TicketData {
  provider: string;
  url: string;
  id: string;
  title: string;
  description: string;
  labels: string[];
  repoUrl: string;
  branch?: string;
  comments: { author: string; body: string; createdAt: string }[];
}

interface TicketInputProps {
  value: string;
  onChange: (value: string) => void;
  detectedProvider: string | null;
  onDetect: () => void;
  detecting: boolean;
  disabled?: boolean;
  onOpenConfig?: () => void;
}

const SUPPORTED_PROVIDERS = ['GitHub Issues', 'Azure DevOps'];

export function TicketInput({
  value,
  onChange,
  detectedProvider,
  onDetect,
  detecting,
  disabled = false,
  onOpenConfig,
}: TicketInputProps) {
  const [focused, setFocused] = useState(false);
  const [testing, setTesting] = useState(false);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData('text');
      if (pasted) {
        // Let the onChange propagate naturally, then trigger detect
        setTimeout(() => onDetect(), 100);
      }
    },
    [onDetect],
  );

  const handleTest = useCallback(async () => {
    if (!value || testing) return;
    setTesting(true);
    setTestError(null);
    setTicketData(null);

    try {
      const connections = loadConnections();
      const key = providerKey(detectedProvider);
      const token = key ? connections[key] : undefined;

      const res = await fetch('/api/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value, ...(token ? { token } : {}) }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error || `HTTP ${res.status}`);
      } else {
        setTicketData(data.ticket);
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setTesting(false);
    }
  }, [value, testing, detectedProvider]);

  const isValidUrl = value.length > 0 && /^https?:\/\/.+/.test(value);

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-2 rounded border bg-vsc-bg-input px-3 py-2 transition-colors ${
          focused ? 'border-vsc-accent-blue' : 'border-vsc-border'
        }`}
      >
        {/* Paste Icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0 text-vsc-text-secondary"
        >
          <path
            d="M10 2H11C12.1 2 13 2.9 13 4V13C13 14.1 12.1 15 11 15H5C3.9 15 3 14.1 3 13V4C3 2.9 3.9 2 5 2H6"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <rect x="5.5" y="1" width="5" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>

        <input
          id="ticket-url"
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder="https://github.com/owner/repo/issues/123"
          className="flex-1 bg-transparent text-sm text-vsc-text-primary placeholder:text-vsc-text-secondary focus:outline-none disabled:opacity-50"
        />

        {/* Detect Button */}
        <button
          type="button"
          onClick={onDetect}
          disabled={!isValidUrl || detecting || disabled}
          className="flex-shrink-0 rounded bg-vsc-bg-tertiary px-3 py-1 text-xs text-vsc-text-primary transition-colors hover:bg-vsc-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {detecting ? (
            <span className="flex items-center gap-1.5">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M14 8A6 6 0 0 0 8 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Detecting...
            </span>
          ) : (
            'Detect'
          )}
        </button>

        {/* Test Button */}
        <button
          type="button"
          onClick={handleTest}
          disabled={!isValidUrl || testing || disabled}
          className="flex-shrink-0 rounded bg-vsc-accent-blue/20 px-3 py-1 text-xs text-vsc-accent-blue transition-colors hover:bg-vsc-accent-blue/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? (
            <span className="flex items-center gap-1.5">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M14 8A6 6 0 0 0 8 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Fetching...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L9 5L1 9V1Z" fill="currentColor" />
              </svg>
              Test
            </span>
          )}
        </button>
      </div>

      {/* Provider Badge / Hint */}
      <div className="flex items-center gap-2 text-xs">
        {detectedProvider ? (
          <span className="inline-flex items-center gap-1 rounded bg-vsc-selection px-2 py-0.5 text-vsc-accent-blue">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {detectedProvider}
          </span>
        ) : (
          <span className="text-vsc-text-secondary">
            Supported: {SUPPORTED_PROVIDERS.join(', ')}
          </span>
        )}
      </div>

      {/* Test Error */}
      {testError && (
        <div className="rounded border border-vsc-error/30 bg-vsc-error/10 px-3 py-2 text-xs text-vsc-error">
          <span>{testError}</span>
          {/unauthorized/i.test(testError) && onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="ml-2 inline-flex items-center gap-1 rounded bg-vsc-bg-tertiary px-2 py-0.5 text-xs text-vsc-accent-blue transition-colors hover:bg-vsc-hover"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M13.6 5.6L10.4 2.4L11.8 1C12.2 0.6 12.9 0.6 13.3 1L15 2.7C15.4 3.1 15.4 3.8 15 4.2L13.6 5.6Z" fill="currentColor" />
                <path d="M1 12L9.4 3.6L12.6 6.8L4.2 15.2H1V12Z" fill="currentColor" />
              </svg>
              Configure
            </button>
          )}
        </div>
      )}

      {/* Ticket Preview */}
      {ticketData && (
        <div className="rounded border border-vsc-border bg-vsc-bg-secondary/95 overflow-hidden">
          {/* Preview Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-vsc-border bg-vsc-bg-tertiary/50">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-vsc-success">
                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-medium text-vsc-text-primary">Ticket fetched successfully</span>
            </div>
            <button
              type="button"
              onClick={() => setTicketData(null)}
              className="text-vsc-text-secondary hover:text-vsc-text-primary transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Preview Content */}
          <div className="px-3 py-2 space-y-2 text-xs">
            {/* Title + ID */}
            <div>
              <span className="text-vsc-text-secondary">#{ticketData.id}</span>
              <span className="mx-1.5 text-vsc-text-secondary/40">|</span>
              <span className="font-medium text-vsc-text-primary">{ticketData.title}</span>
            </div>

            {/* Provider + Labels */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded bg-vsc-selection px-1.5 py-0.5 text-vsc-accent-blue">
                {ticketData.provider}
              </span>
              {ticketData.labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded bg-vsc-bg-tertiary px-1.5 py-0.5 text-vsc-text-secondary"
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Description */}
            {ticketData.description && (
              <div className="rounded bg-vsc-bg-primary/50 p-2 max-h-32 overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words text-vsc-text-secondary font-[inherit] text-xs leading-relaxed">
                  {ticketData.description}
                </pre>
              </div>
            )}

            {/* Repo + Branch */}
            {(ticketData.repoUrl || ticketData.branch) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-vsc-text-secondary">
                {ticketData.repoUrl && (
                  <span className="flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 1V7M5 7L3 5M5 7L7 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M1 9H9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                    {ticketData.repoUrl.replace(/^https?:\/\//, '')}
                  </span>
                )}
                {ticketData.branch && (
                  <span className="flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1" />
                      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1" />
                      <path d="M3 4.5V6C3 6.5 3.5 7 4 7H5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                    {ticketData.branch}
                  </span>
                )}
              </div>
            )}

            {/* Comments count */}
            {ticketData.comments.length > 0 && (
              <span className="text-vsc-text-secondary">
                {ticketData.comments.length} comment{ticketData.comments.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
