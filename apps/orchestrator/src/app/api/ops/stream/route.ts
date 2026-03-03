import { wsState } from '@/core/ws-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send recent history
      const recent = wsState.opsLogs.slice(-50);
      for (const entry of recent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
      }

      // Subscribe to new entries
      unsubscribe = wsState.onOpsLog((entry) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
        } catch {
          unsubscribe?.();
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
