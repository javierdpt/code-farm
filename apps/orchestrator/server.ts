import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { setupWebSocketServer } from './src/lib/ws-manager.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
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
  });
});
