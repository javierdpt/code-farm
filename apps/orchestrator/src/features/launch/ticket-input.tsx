'use client';

import { useState, useCallback } from 'react';

interface TicketInputProps {
  value: string;
  onChange: (value: string) => void;
  detectedProvider: string | null;
  onDetect: () => void;
  detecting: boolean;
  disabled?: boolean;
}

const SUPPORTED_PROVIDERS = ['GitHub Issues', 'Azure DevOps', 'Trello', 'Monday.com'];

export function TicketInput({
  value,
  onChange,
  detectedProvider,
  onDetect,
  detecting,
  disabled = false,
}: TicketInputProps) {
  const [focused, setFocused] = useState(false);

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

  const isValidUrl = value.length > 0 && /^https?:\/\/.+/.test(value);

  return (
    <div className="space-y-2">
      <label htmlFor="ticket-url" className="block text-sm font-medium text-vsc-text-primary">
        Ticket URL
      </label>
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
    </div>
  );
}
