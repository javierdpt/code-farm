'use client';

interface TerminalSessionDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TerminalSessionDialog({ open, onConfirm, onCancel }: TerminalSessionDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="mx-4 max-w-lg rounded-lg border border-vsc-border bg-vsc-bg-secondary p-6 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-vsc-warning">
          Terminal Session Warning
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-vsc-text-secondary">
          Switching views will <span className="text-vsc-text-primary font-medium">end your current terminal session</span>.
          Any running processes will be lost. Use <span className="text-vsc-accent-teal font-medium">tmux</span> for
          persistent sessions that survive disconnects.
        </p>

        <div className="mb-4 rounded border border-vsc-border bg-vsc-bg-tertiary p-3 text-xs">
          <p className="mb-2 text-vsc-accent-blue font-medium">Quick tmux guide:</p>
          <div className="space-y-1 font-mono text-vsc-text-secondary">
            <p><span className="text-vsc-accent-teal">tmux</span> — start a new session</p>
            <p><span className="text-vsc-accent-teal">tmux new -s name</span> — start a named session</p>
            <p><span className="text-vsc-accent-teal">tmux attach -t name</span> — reattach to a session</p>
            <p><span className="text-vsc-accent-teal">tmux ls</span> — list active sessions</p>
            <p><span className="text-vsc-accent-teal">Ctrl+B, D</span> — detach (session keeps running)</p>
          </div>
          <a
            href="https://github.com/tmux/tmux/wiki/Getting-Started"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-vsc-accent-blue hover:underline"
          >
            tmux documentation &rarr;
          </a>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-vsc-border px-4 py-1.5 text-xs text-vsc-text-secondary transition-colors hover:bg-vsc-hover hover:text-vsc-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-vsc-accent-blue px-4 py-1.5 text-xs text-white transition-colors hover:bg-vsc-accent-blue/80"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
