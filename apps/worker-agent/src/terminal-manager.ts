import * as pty from 'node-pty';
import { randomBytes } from 'node:crypto';

interface TerminalSession {
  sessionId: string;
  containerId: string;
  ptyProcess: pty.IPty;
  cols: number;
  rows: number;
}

/**
 * Manages interactive terminal sessions inside Podman containers.
 *
 * Each session spawns `podman exec -it` via node-pty to provide a real
 * pseudo-terminal with proper input echo, line editing, and signal support.
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

    // Build env with all string values (node-pty requires Record<string, string>)
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
    env.TERM = 'xterm-256color';

    const ptyProcess = pty.spawn(
      'podman',
      ['exec', '-it', containerId, '/bin/bash'],
      {
        name: 'xterm-256color',
        cols,
        rows,
        env,
      },
    );

    const session: TerminalSession = {
      sessionId,
      containerId,
      ptyProcess,
      cols,
      rows,
    };

    this.sessions.set(sessionId, session);

    ptyProcess.onData((data: string) => {
      onData(Buffer.from(data));
    });

    ptyProcess.onExit(({ exitCode }) => {
      this.sessions.delete(sessionId);
      console.log(
        `[WorkerAgent] Terminal session ${sessionId} exited (code=${exitCode})`,
      );
      onExit(exitCode);
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

    session.ptyProcess.write(data.toString());
  }

  /**
   * Resize a terminal session.
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
    session.ptyProcess.resize(cols, rows);
  }

  /**
   * Close a terminal session by killing its process.
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
    session.ptyProcess.kill();
    this.sessions.delete(sessionId);
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
