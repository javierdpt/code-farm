import { getWSState } from '@/core/ws-state';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const wsState = getWSState();
  const buffer = wsState.getBuildBuffer(requestId);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send existing lines
      for (const line of buffer.lines) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'output', data: line })}\n\n`));
      }

      if (buffer.done) {
        if (buffer.error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: buffer.error })}\n\n`));
        } else if (buffer.result) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', ...buffer.result })}\n\n`));
        }
        controller.close();
        return;
      }

      // Subscribe to new events
      const listener = (event: string) => {
        try {
          controller.enqueue(encoder.encode(event));
          // Check if done
          if (buffer.done) {
            buffer.listeners.delete(listener);
            controller.close();
          }
        } catch {
          buffer.listeners.delete(listener);
        }
      };

      buffer.listeners.add(listener);
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
