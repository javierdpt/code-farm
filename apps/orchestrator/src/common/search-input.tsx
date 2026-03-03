'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }: SearchInputProps) {
  const [internal, setInternal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  const handleChange = (v: string) => {
    setInternal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 200);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className={`relative ${className}`}>
      {/* Magnifying glass */}
      <svg
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-vsc-text-secondary"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12.5 12.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        value={internal}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-vsc-border bg-vsc-bg-input py-1.5 pl-8 pr-7 text-sm text-vsc-text-primary placeholder:text-vsc-text-secondary/50 focus:border-vsc-accent-blue focus:outline-none"
      />
      {/* Clear button */}
      {internal && (
        <button
          type="button"
          onClick={() => handleChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-vsc-text-secondary hover:text-vsc-text-primary"
          aria-label="Clear search"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
