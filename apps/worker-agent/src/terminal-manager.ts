import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';

interface TerminalSession {
  sessionId: string;
  containerId: string;
  process: ChildProcess;
  cols: number;
  rows: number;
}

/**
 * Manages interactive terminal sessions inside Podman containers.
 *
 * Each session spawns `podman exec -it` as a child process with piped stdio.
 * Data is forwarded via callbacks so it can be relayed over WebSocket
 * to the frontend.
 */
export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();

  /**
   * Open a new terminal session inside the given container.
   *
   * @param containerId - Podman container ID or name
   * @param cols        - Initial terminal width in columns
   * @param rows        - Initial terminal height in rows
   * @param onData      - Called with output data from the terminal
   * @param onExit      - Called when the terminal process exits
   * @returns The generated session ID
   */
  open(
    containerId: string,
    cols: number,
    rows: number,
    onData: (data: Buffer) => void,
    onExit: (code: number | null) => void,
  ): string {
    const sessionId = randomBytes(8).toString('hex');

    const child = spawn(
      'podman',
      ['exec', '-it', containerId, '/bin/bash'],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLUMNS: String(cols),
          LINES: String(rows),
        },
      },
    );

    const session: TerminalSession = {
      sessionId,
      containerId,
      process: child,
      cols,
      rows,
    };

    this.sessions.set(sessionId, session);

    child.stdout?.on('data', (chunk: Buffer) => {
      onData(chunk);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      onData(chunk);
    });

    child.on('exit', (code) => {
      this.sessions.delete(sessionId);
      console.log(
        `[WorkerAgent] Terminal session ${sessionId} exited (code=${code})`,
      );
      onExit(code);
    });

    child.on('error', (err) => {
      console.error(
        `[WorkerAgent] Terminal session ${sessionId} error: ${err.message}`,
      );
      this.sessions.delete(sessionId);
      onExit(1);
    });

    console.log(
      `[WorkerAgent] Terminal session ${sessionId} opened for container ${containerId.substring(0, 12)}`,
    );

    return sessionId;
  }

  /**
   * Write data to the terminal session's stdin.
   */
  write(sessionId: string, data: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(
        `[WorkerAgent] Cannot write: terminal session ${sessionId} not found`,
      );
      return;
    }

    if (!session.process.stdin?.writable) {
      console.warn(
        `[WorkerAgent] Cannot write: terminal session ${sessionId} stdin is not writable`,
      );
      return;
    }

    session.process.stdin.write(data);
  }

  /**
   * Resize a terminal session.
   *
   * Since we are not using node-pty, true PTY resize is not available.
   * We store the new dimensions and attempt to run `stty` inside the
   * container to propagate the size.
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(
        `[WorkerAgent] Cannot resize: terminal session ${sessionId} not found`,
      );
      return;
    }

    session.cols = cols;
    session.rows = rows;

    // Attempt to set terminal size via stty. This may not work perfectly
    // without a true PTY, but it is the best effort approach.
    const sttyCmd = `stty rows ${rows} cols ${cols} 2>/dev/null\n`;
    if (session.process.stdin?.writable) {
      session.process.stdin.write(sttyCmd);
    }
  }

  /**
   * Close a terminal session by killing its child process.
   */
  close(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(
        `[WorkerAgent] Cannot close: terminal session ${sessionId} not found`,
      );
      return;
    }

    console.log(`[WorkerAgent] Closing terminal session ${sessionId}`);
    session.process.kill('SIGTERM');

    // Force kill after a short grace period
    setTimeout(() => {
      if (this.sessions.has(sessionId)) {
        session.process.kill('SIGKILL');
        this.sessions.delete(sessionId);
      }
    }, 3000);
  }

  /**
   * Close all active terminal sessions. Used during graceful shutdown.
   */
  closeAll(): void {
    console.log(
      `[WorkerAgent] Closing all terminal sessions (${this.sessions.size} active)`,
    );

    for (const [sessionId] of this.sessions) {
      this.close(sessionId);
    }
  }

  /**
   * Return the number of active terminal sessions.
   */
  get activeCount(): number {
    return this.sessions.size;
  }
}
