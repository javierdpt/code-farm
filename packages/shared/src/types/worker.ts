import { z } from 'zod';

// --- Worker Status ---

export const WorkerStatusSchema = z.enum([
  'connecting',
  'online',
  'offline',
  'error',
]);

export type WorkerStatus = z.infer<typeof WorkerStatusSchema>;

// --- Worker Registration ---

export const WorkerRegistrationSchema = z.object({
  name: z.string().min(1),
  hostname: z.string().min(1),
  platform: z.string().min(1),
  cpuCount: z.number().int().positive(),
  memoryTotal: z.number().positive(),
});

export type WorkerRegistration = z.infer<typeof WorkerRegistrationSchema>;

// --- Worker Info ---

export const WorkerInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: WorkerStatusSchema,
  hostname: z.string().min(1),
  platform: z.string().min(1),
  cpuCount: z.number().int().positive(),
  cpuUsage: z.number().nonnegative().optional(),
  memoryTotal: z.number().positive(),
  memoryFree: z.number().nonnegative(),
  diskTotal: z.number().nonnegative().optional(),
  diskFree: z.number().nonnegative().optional(),
  containersRunning: z.number().int().nonnegative(),
  lastHeartbeat: z.coerce.date(),
  connectedAt: z.coerce.date(),
});

export type WorkerInfo = z.infer<typeof WorkerInfoSchema>;
