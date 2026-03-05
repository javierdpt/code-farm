import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getWSState } from '@/core/ws-state';
import { createImageBuild, generateRequestId } from '@javierdpt/code-farm-shared';

export async function POST(req: Request) {
  const body = await req.json();
  const { template, dockerfile: customDockerfile, tag, workerName } = body;
  const wsState = getWSState();

  let dockerfile: string;

  if (template) {
    const containerfile = path.join(process.cwd(), 'containers', template, 'Containerfile');
    try {
      dockerfile = fs.readFileSync(containerfile, 'utf-8');
    } catch {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
  } else if (customDockerfile) {
    dockerfile = customDockerfile;
  } else {
    return NextResponse.json({ error: 'Either template or dockerfile is required' }, { status: 400 });
  }

  // Pick target worker
  const workerIds = Array.from(wsState.workerSockets.keys());
  if (workerIds.length === 0) {
    return NextResponse.json({ error: 'No workers available' }, { status: 503 });
  }

  // Use specified worker or first available
  const targetWorkerId = workerName
    ? workerIds.find(id => id === workerName) || workerIds[0]
    : workerIds[0];

  const requestId = generateRequestId();
  const message = createImageBuild(requestId, dockerfile, tag || `localhost/${template || 'custom'}:latest`);

  wsState.sendToWorker(targetWorkerId, message);

  return NextResponse.json({ requestId, workerId: targetWorkerId });
}
