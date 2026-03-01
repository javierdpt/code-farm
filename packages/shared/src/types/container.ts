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

// --- Container Info ---

export const ContainerInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: ContainerStatusSchema,
  workerId: z.string().min(1),
  workerName: z.string().min(1),
  ticketUrl: z.string().url(),
  ticketTitle: z.string().min(1),
  repoUrl: z.string().url(),
  branch: z.string().min(1),
  createdAt: z.coerce.date(),
  image: z.string().min(1),
});

export type ContainerInfo = z.infer<typeof ContainerInfoSchema>;

// --- Container Create Request ---

export const ContainerCreateRequestSchema = z.object({
  ticketUrl: z.string().url(),
  ticketTitle: z.string().min(1),
  repoUrl: z.string().url(),
  branch: z.string().min(1),
  workerName: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
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
