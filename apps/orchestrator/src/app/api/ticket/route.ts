import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const TestTicketSchema = z.object({
  url: z.string().url(),
  token: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = TestTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { url, token } = parsed.data;

  try {
    const { resolveProvider } = await import('@code-farm/ticket-providers');
    const provider = resolveProvider(url);
    if (!provider) {
      return NextResponse.json(
        { error: `No ticket provider found for URL: ${url}` },
        { status: 400 },
      );
    }

    const ticket = await provider.fetch(url, { token });
    return NextResponse.json({ ticket }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch ticket: ${errorMessage}` },
      { status: 500 },
    );
  }
}
