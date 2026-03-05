import { createServer } from 'http';
import { parse } from 'url';
import { networkInterfaces } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import next from 'next';
import { setupWebSocketServer } from './src/core/ws-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// In production (installed package), point Next.js to the package root where .next/ lives
const dir = dev ? undefined : join(__dirname, '..');
const app = next({ dev, hostname, port, dir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const { workerWss, terminalWss } = setupWebSocketServer(server);

  server.listen(port, hostname, () => {
    console.log(`[Orchestrator] Ready on http://${hostname}:${port}`);
    console.log(`[Orchestrator] Worker WS endpoint: ws://${hostname}:${port}/ws/worker`);
    console.log(`[Orchestrator] Terminal WS endpoint: ws://${hostname}:${port}/ws/terminal`);

    // Log connectable URLs with actual network IPs so users know what to set for ORCHESTRATOR_URL
    const ips: string[] = [];
    const nets = networkInterfaces();
    for (const ifaces of Object.values(nets)) {
      for (const iface of ifaces ?? []) {
        if (!iface.internal && iface.family === 'IPv4') {
          ips.push(iface.address);
        }
      }
    }
    if (ips.length > 0) {
      console.log(`[Orchestrator] Connect workers using:`);
      for (const ip of ips) {
        console.log(`[Orchestrator]   ORCHESTRATOR_URL=ws://${ip}:${port}/ws/worker`);
      }
    }
  });
});
