'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppShell } from '@/layout/app-shell';
import Editor from '@monaco-editor/react';

interface Template {
  name: string;
  path: string;
}

interface WorkerInfo {
  id: string;
  name: string;
  status: string;
  containersRunning: number;
}

type BuildPhase = 'idle' | 'building' | 'done' | 'error';

export default function BuildPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [dockerfile, setDockerfile] = useState('');
  const [tag, setTag] = useState('');
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [buildPhase, setBuildPhase] = useState<BuildPhase>('idle');
  const [buildOutput, setBuildOutput] = useState<string[]>([]);
  const [buildResult, setBuildResult] = useState<{ imageId: string; tag: string } | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch templates
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/templates');
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates ?? []);
        }
      } catch {
        // ignore
      }
    }
    fetchTemplates();
  }, []);

  // Fetch workers
  useEffect(() => {
    async function fetchWorkers() {
      try {
        const res = await fetch('/api/workers');
        if (res.ok) {
          const data = await res.json();
          setWorkers(data.workers ?? []);
        }
      } catch {
        // ignore
      }
    }
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch template content when selected
  useEffect(() => {
    if (!selectedTemplate || isCustom) return;
    async function fetchTemplate() {
      try {
        const res = await fetch(`/api/templates/${selectedTemplate}`);
        if (res.ok) {
          const data = await res.json();
          setDockerfile(data.dockerfile ?? '');
          setTag(`localhost/${selectedTemplate}:latest`);
        }
      } catch {
        // ignore
      }
    }
    fetchTemplate();
  }, [selectedTemplate, isCustom]);

  // Auto-scroll build output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [buildOutput]);

  const handleSelectTemplate = useCallback((name: string) => {
    setIsCustom(false);
    setSelectedTemplate(name);
  }, []);

  const handleSelectCustom = useCallback(() => {
    setIsCustom(true);
    setSelectedTemplate('');
    setDockerfile('');
    setTag('localhost/custom:latest');
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setDockerfile(content);
    };
    reader.readAsText(file);
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }, []);

  const handleBuild = useCallback(async () => {
    if (!dockerfile.trim()) return;

    setBuildPhase('building');
    setBuildOutput([]);
    setBuildResult(null);
    setBuildError(null);

    try {
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isCustom ? { dockerfile } : { template: selectedTemplate }),
          tag: tag || undefined,
          workerName: selectedWorker || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { requestId } = await res.json();

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/build/${requestId}/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'output':
              setBuildOutput(prev => [...prev, data.data]);
              break;
            case 'done':
              setBuildResult({ imageId: data.imageId, tag: data.tag });
              setBuildPhase('done');
              eventSource.close();
              break;
            case 'error':
              setBuildError(data.error);
              setBuildPhase('error');
              eventSource.close();
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        // If the stream ends without explicit done/error, check phase
        eventSource.close();
        setBuildPhase(prev => prev === 'building' ? 'error' : prev);
        if (buildPhase === 'building') {
          setBuildError('Connection to build stream lost');
        }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setBuildError(message);
      setBuildPhase('error');
    }
  }, [dockerfile, isCustom, selectedTemplate, tag, selectedWorker, buildPhase]);

  const isBuilding = buildPhase === 'building';
  const canBuild = dockerfile.trim().length > 0 && !isBuilding;
  const onlineWorkers = workers.filter(w => w.status === 'online');

  return (
    <AppShell
      title="Build Image"
      workerCount={onlineWorkers.length}
      containerCount={0}
      connected={onlineWorkers.length > 0}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Template Selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-vsc-text-primary">
            Container Template
          </label>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <button
                key={t.name}
                type="button"
                onClick={() => handleSelectTemplate(t.name)}
                disabled={isBuilding}
                className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                  !isCustom && selectedTemplate === t.name
                    ? 'border-vsc-accent-blue bg-vsc-accent-blue/20 text-vsc-accent-blue'
                    : 'border-vsc-border bg-vsc-bg-secondary text-vsc-text-secondary hover:border-vsc-text-secondary hover:text-vsc-text-primary'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {t.name}
              </button>
            ))}
            <button
              type="button"
              onClick={handleSelectCustom}
              disabled={isBuilding}
              className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                isCustom
                  ? 'border-vsc-accent-blue bg-vsc-accent-blue/20 text-vsc-accent-blue'
                  : 'border-vsc-border bg-vsc-bg-secondary text-vsc-text-secondary hover:border-vsc-text-secondary hover:text-vsc-text-primary'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Containerfile Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-vsc-text-primary">
              Containerfile
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".dockerfile,Containerfile,Dockerfile,*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBuilding}
                className="rounded border border-vsc-border bg-vsc-bg-secondary px-3 py-1 text-xs text-vsc-text-secondary transition-colors hover:border-vsc-text-secondary hover:text-vsc-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Upload File
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded border border-vsc-border">
            <Editor
              height="400px"
              defaultLanguage="dockerfile"
              theme="vs-dark"
              value={dockerfile}
              onChange={(value) => setDockerfile(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                padding: { top: 8 },
              }}
            />
          </div>
        </div>

        {/* Image Tag + Worker */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="image-tag" className="block text-sm font-medium text-vsc-text-primary">
              Image Tag
            </label>
            <input
              id="image-tag"
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              disabled={isBuilding}
              placeholder="localhost/my-image:latest"
              className="w-full rounded border border-vsc-border bg-vsc-bg-input px-3 py-2 text-sm text-vsc-text-primary placeholder:text-vsc-text-secondary focus:border-vsc-accent-blue focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="build-worker-select" className="block text-sm font-medium text-vsc-text-primary">
              Target Worker
            </label>
            <select
              id="build-worker-select"
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              disabled={isBuilding}
              className="w-full rounded border border-vsc-border bg-vsc-bg-input px-3 py-2 text-sm text-vsc-text-primary focus:border-vsc-accent-blue focus:outline-none disabled:opacity-50"
            >
              <option value="">Auto (first available)</option>
              {onlineWorkers.map(worker => (
                <option key={worker.id} value={worker.name}>
                  {worker.name} ({worker.containersRunning} containers)
                </option>
              ))}
            </select>
            <p className="text-xs text-vsc-text-secondary">
              {onlineWorkers.length === 0
                ? 'No workers online. A worker must be connected to build.'
                : `${onlineWorkers.length} worker${onlineWorkers.length !== 1 ? 's' : ''} available`}
            </p>
          </div>
        </div>

        {/* Build Button */}
        <button
          type="button"
          onClick={handleBuild}
          disabled={!canBuild}
          className="w-full rounded bg-vsc-accent-blue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vsc-accent-blue/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBuilding ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M14 8A6 6 0 0 0 8 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Building...
            </span>
          ) : (
            'Build Image'
          )}
        </button>

        {/* Build Output */}
        {(buildOutput.length > 0 || buildPhase !== 'idle') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-vsc-text-primary">
                Build Output
              </label>
              {buildPhase === 'done' && buildResult && (
                <span className="text-xs text-green-400">
                  Image built: {buildResult.imageId.substring(0, 12)}
                </span>
              )}
              {buildPhase === 'error' && (
                <span className="text-xs text-red-400">Build failed</span>
              )}
            </div>
            <div
              ref={outputRef}
              className="h-[300px] overflow-auto rounded border border-vsc-border bg-[#1e1e1e] p-4 font-mono text-sm text-green-400"
            >
              {buildOutput.map((line, i) => (
                <pre key={i} className="whitespace-pre-wrap break-all">{line}</pre>
              ))}
              {buildPhase === 'done' && buildResult && (
                <pre className="mt-2 text-vsc-accent-blue">
                  {'\n'}Successfully built {buildResult.tag} ({buildResult.imageId.substring(0, 12)})
                </pre>
              )}
              {buildPhase === 'error' && buildError && (
                <pre className="mt-2 text-red-400">
                  {'\n'}Error: {buildError}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
