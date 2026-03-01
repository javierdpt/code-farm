import { ZodError } from 'zod';
import {
  WorkerMessageSchema,
  OrchestratorMessageSchema,
  BrowserTerminalMessageSchema,
} from '../types/messages.js';
import type {
  WorkerMessage,
  OrchestratorMessage,
  BrowserTerminalMessage,
} from '../types/messages.js';

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}

/**
 * Parse and validate a worker-to-orchestrator message.
 * Throws a descriptive error if the data does not match any known worker message type.
 */
export function parseWorkerMessage(data: unknown): WorkerMessage {
  try {
    return WorkerMessageSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const typeField = typeof data === 'object' && data !== null && 'type' in data
        ? (data as Record<string, unknown>).type
        : undefined;
      throw new Error(
        `Invalid worker message${typeField ? ` (type: "${typeField}")` : ''}: ${formatZodError(error)}`,
      );
    }
    throw error;
  }
}

/**
 * Parse and validate an orchestrator-to-worker message.
 * Throws a descriptive error if the data does not match any known orchestrator message type.
 */
export function parseOrchestratorMessage(data: unknown): OrchestratorMessage {
  try {
    return OrchestratorMessageSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const typeField = typeof data === 'object' && data !== null && 'type' in data
        ? (data as Record<string, unknown>).type
        : undefined;
      throw new Error(
        `Invalid orchestrator message${typeField ? ` (type: "${typeField}")` : ''}: ${formatZodError(error)}`,
      );
    }
    throw error;
  }
}

/**
 * Parse and validate a browser-to-orchestrator terminal message.
 * Throws a descriptive error if the data does not match any known browser terminal message type.
 */
export function parseBrowserTerminalMessage(data: unknown): BrowserTerminalMessage {
  try {
    return BrowserTerminalMessageSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const typeField = typeof data === 'object' && data !== null && 'type' in data
        ? (data as Record<string, unknown>).type
        : undefined;
      throw new Error(
        `Invalid browser terminal message${typeField ? ` (type: "${typeField}")` : ''}: ${formatZodError(error)}`,
      );
    }
    throw error;
  }
}
