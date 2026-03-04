import WebSocket from 'ws';
import {
  RECONNECT_BASE_DELAY,
  RECONNECT_MAX_DELAY,
} from '@javierdpt/code-farm-shared';

export interface WSClientEvents {
  onOpen: () => void;
  onMessage: (data: unknown) => void;
  onClose: (code: number, reason: string) => void;
  onError: (error: Error) => void;
}

/**
 * WebSocket client that connects to the orchestrator with
 * automatic exponential-backoff reconnection.
 */
export class WorkerWSClient {
  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_BASE_DELAY;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private readonly url: string;
  private readonly events: WSClientEvents;

  constructor(url: string, events: WSClientEvents) {
    this.url = url;
    this.events = events;
  }

  /**
   * Establish a WebSocket connection to the orchestrator.
   * Automatically reconnects with exponential backoff on disconnection.
   */
  connect(): void {
    this.intentionallyClosed = false;
    this.createConnection();
  }

  /**
   * Serialize and send a message over the WebSocket.
   * Silently drops messages if the connection is not open.
   */
  send(message: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WorkerAgent] Cannot send message: WebSocket is not open');
      return;
    }

    try {
      const payload = JSON.stringify(message);
      this.ws.send(payload);
    } catch (err) {
      console.error('[WorkerAgent] Failed to serialize message:', err);
    }
  }

  /**
   * Gracefully close the WebSocket connection without reconnecting.
   */
  disconnect(): void {
    this.intentionallyClosed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client shutting down');
      this.ws = null;
    }

    console.log('[WorkerAgent] WebSocket disconnected');
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private createConnection(): void {
    console.log(`[WorkerAgent] Connecting to ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      console.error('[WorkerAgent] Failed to create WebSocket:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      console.log('[WorkerAgent] WebSocket connected');
      this.reconnectDelay = RECONNECT_BASE_DELAY; // reset backoff on success
      this.events.onOpen();
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const parsed: unknown = JSON.parse(raw.toString());
        this.events.onMessage(parsed);
      } catch (err) {
        console.error('[WorkerAgent] Failed to parse incoming message:', err);
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason.toString();
      console.log(
        `[WorkerAgent] WebSocket closed (code=${code}, reason="${reasonStr}")`,
      );
      this.ws = null;
      this.events.onClose(code, reasonStr);

      if (!this.intentionallyClosed) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err: Error) => {
      console.error('[WorkerAgent] WebSocket error:', err.message);
      this.events.onError(err);
      // The 'close' event will fire after 'error', which triggers reconnect
    });

    this.ws.on('ping', () => {
      this.ws?.pong();
    });
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed) return;

    console.log(
      `[WorkerAgent] Reconnecting in ${this.reconnectDelay / 1000}s...`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.createConnection();
    }, this.reconnectDelay);

    // Exponential backoff: double the delay, capped at max
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      RECONNECT_MAX_DELAY,
    );
  }
}
