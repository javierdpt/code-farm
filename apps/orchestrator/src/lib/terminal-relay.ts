// Terminal relay manages the mapping between browser terminal sessions and worker terminal sessions
import { WebSocket } from 'ws';

interface TerminalBridge {
  browserWs: WebSocket;
  workerId: string;
  containerId: string;
  sessionId?: string;
}

class TerminalRelay {
  private bridges = new Map<string, TerminalBridge>(); // sessionId -> bridge
  private browserToSession = new Map<WebSocket, string>(); // browser ws -> sessionId

  addBridge(browserWs: WebSocket, workerId: string, containerId: string): string {
    // Use a temporary key until the sessionId is assigned
    const tempKey = `pending-${crypto.randomUUID()}`;
    const bridge: TerminalBridge = { browserWs, workerId, containerId };
    this.bridges.set(tempKey, bridge);
    this.browserToSession.set(browserWs, tempKey);
    return tempKey;
  }

  setSessionId(browserWs: WebSocket, sessionId: string): void {
    const tempKey = this.browserToSession.get(browserWs);
    if (!tempKey) return;

    const bridge = this.bridges.get(tempKey);
    if (!bridge) return;

    // Move from temp key to real session key
    this.bridges.delete(tempKey);
    bridge.sessionId = sessionId;
    this.bridges.set(sessionId, bridge);
    this.browserToSession.set(browserWs, sessionId);
  }

  getBridgeBySession(sessionId: string): TerminalBridge | undefined {
    return this.bridges.get(sessionId);
  }

  getBridgeByBrowser(browserWs: WebSocket): TerminalBridge | undefined {
    const key = this.browserToSession.get(browserWs);
    if (!key) return undefined;
    return this.bridges.get(key);
  }

  removeBridge(browserWs: WebSocket): void {
    const key = this.browserToSession.get(browserWs);
    if (key) {
      this.bridges.delete(key);
    }
    this.browserToSession.delete(browserWs);
  }
}

export const terminalRelay = new TerminalRelay();
