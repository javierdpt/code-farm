'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'codefarm:connections';

export interface Connections {
  github?: string;
  'azure-devops'?: string;
}

export function loadConnections(): Connections {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveConnections(connections: Connections) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
}

/** Map detected provider display name → connections key */
export function providerKey(
  detectedProvider: string | null,
): keyof Connections | null {
  if (!detectedProvider) return null;
  const lower = detectedProvider.toLowerCase();
  if (lower.includes('github')) return 'github';
  if (lower.includes('azure')) return 'azure-devops';
  return null;
}

interface ConnectionConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ProviderSectionProps {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClear: () => void;
  saved: boolean;
}

function ProviderSection({
  label,
  hint,
  value,
  onChange,
  onSave,
  onClear,
  saved,
}: ProviderSectionProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-vsc-text-primary">{label}</span>
        {saved && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="text-vsc-success"
          >
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M4 7L6 9L10 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <p className="text-xs text-vsc-text-secondary">{hint}</p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste token here"
            className="w-full rounded border border-vsc-border bg-vsc-bg-input px-3 py-1.5 pr-8 text-xs text-vsc-text-primary placeholder:text-vsc-text-secondary focus:border-vsc-accent-blue focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-vsc-text-secondary hover:text-vsc-text-primary"
            title={visible ? 'Hide' : 'Show'}
          >
            {visible ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 2L14 14M6.5 6.5A2 2 0 0 0 9.5 9.5M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!value.trim()}
          className="rounded bg-vsc-accent-blue/20 px-3 py-1.5 text-xs text-vsc-accent-blue transition-colors hover:bg-vsc-accent-blue/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!saved}
          className="rounded bg-vsc-bg-tertiary px-3 py-1.5 text-xs text-vsc-text-secondary transition-colors hover:bg-vsc-hover hover:text-vsc-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export function ConnectionConfigDialog({
  open,
  onClose,
}: ConnectionConfigDialogProps) {
  const [github, setGithub] = useState('');
  const [azureDevOps, setAzureDevOps] = useState('');
  const [savedGithub, setSavedGithub] = useState(false);
  const [savedAzure, setSavedAzure] = useState(false);

  // Load on open
  useEffect(() => {
    if (!open) return;
    const c = loadConnections();
    setGithub(c.github ?? '');
    setAzureDevOps(c['azure-devops'] ?? '');
    setSavedGithub(!!c.github);
    setSavedAzure(!!c['azure-devops']);
  }, [open]);

  const handleSaveGithub = useCallback(() => {
    const c = loadConnections();
    c.github = github.trim();
    saveConnections(c);
    setSavedGithub(true);
  }, [github]);

  const handleClearGithub = useCallback(() => {
    const c = loadConnections();
    delete c.github;
    saveConnections(c);
    setGithub('');
    setSavedGithub(false);
  }, []);

  const handleSaveAzure = useCallback(() => {
    const c = loadConnections();
    c['azure-devops'] = azureDevOps.trim();
    saveConnections(c);
    setSavedAzure(true);
  }, [azureDevOps]);

  const handleClearAzure = useCallback(() => {
    const c = loadConnections();
    delete c['azure-devops'];
    saveConnections(c);
    setAzureDevOps('');
    setSavedAzure(false);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-lg rounded-lg border border-vsc-border bg-vsc-bg-secondary p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-vsc-text-primary">
            Provider Connections
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-vsc-text-secondary transition-colors hover:text-vsc-text-primary"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M3 3L11 11M11 3L3 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          <ProviderSection
            label="GitHub"
            hint="Create a PAT at github.com/settings/tokens with repo scope"
            value={github}
            onChange={setGithub}
            onSave={handleSaveGithub}
            onClear={handleClearGithub}
            saved={savedGithub}
          />

          <div className="border-t border-vsc-border" />

          <ProviderSection
            label="Azure DevOps"
            hint="Create a PAT at dev.azure.com/{org}/_usersSettings/tokens with Work Items read scope"
            value={azureDevOps}
            onChange={setAzureDevOps}
            onSave={handleSaveAzure}
            onClear={handleClearAzure}
            saved={savedAzure}
          />
        </div>
      </div>
    </div>
  );
}
