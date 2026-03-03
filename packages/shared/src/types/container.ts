import { z } from 'zod';

// --- Container Status ---

export const ContainerStatusSchema = z.enum([
  'creating',
  'running',
  'stopped',
  'error',
  'removing',
]);

export type ContainerStatus = z.infer<typeof ContainerStatusSchema>;

// --- Container Resources ---

export const ContainerResourcesSchema = z.object({
  memoryLimit: z.number().nonnegative(),   // bytes, 0 = unlimited
  cpuLimit: z.number().nonnegative(),      // nanoseconds (NanoCpus), 0 = unlimited
  diskUsage: z.number().nonnegative(),     // bytes
  memoryUsage: z.number().nonnegative(),   // bytes, 0 if stopped
  cpuPercent: z.number().nonnegative(),    // percentage, 0 if stopped
});

export type ContainerResources = z.infer<typeof ContainerResourcesSchema>;

// --- Container Info ---

export const ContainerInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: ContainerStatusSchema,
  workerId: z.string().min(1),
  workerName: z.string().min(1),
  ticketUrl: z.string().default(''),
  ticketTitle: z.string().default(''),
  repoUrl: z.string().default(''),
  branch: z.string().default(''),
  createdAt: z.coerce.date(),
  image: z.string().min(1),
  managed: z.boolean().default(false),
  resources: ContainerResourcesSchema.optional(),
});

export type ContainerInfo = z.infer<typeof ContainerInfoSchema>;

// --- Container Create Request ---

export const ContainerCreateRequestSchema = z.object({
  ticketUrl: z.string().optional(),
  ticketTitle: z.string().optional(),
  repoUrl: z.string().optional(),
  branch: z.string().optional(),
  workerName: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  memoryMb: z.number().int().positive().optional(),
});

export type ContainerCreateRequest = z.infer<typeof ContainerCreateRequestSchema>;

// --- Container Labels ---

export const ContainerLabelsSchema = z.object({
  'claude-farm.managed': z.string(),
  'claude-farm.ticket-url': z.string(),
  'claude-farm.ticket-title': z.string(),
  'claude-farm.repo-url': z.string(),
  'claude-farm.branch': z.string(),
  'claude-farm.worker-id': z.string(),
  'claude-farm.worker-name': z.string(),
});

export type ContainerLabels = z.infer<typeof ContainerLabelsSchema>;
