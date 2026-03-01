import { z } from 'zod';

// --- Terminal Session ---

export const TerminalSessionSchema = z.object({
  sessionId: z.string().min(1),
  containerId: z.string().min(1),
  workerId: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  createdAt: z.coerce.date(),
});

export type TerminalSession = z.infer<typeof TerminalSessionSchema>;

// --- Terminal Open Request ---

export const TerminalOpenRequestSchema = z.object({
  containerId: z.string().min(1),
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
});

export type TerminalOpenRequest = z.infer<typeof TerminalOpenRequestSchema>;

// --- Terminal Resize Request ---

export const TerminalResizeRequestSchema = z.object({
  sessionId: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export type TerminalResizeRequest = z.infer<typeof TerminalResizeRequestSchema>;
