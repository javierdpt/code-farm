import { z } from 'zod';

// --- Ticket Provider ---

export const TicketProviderSchema = z.enum([
  'github',
  'azure-devops',
  'trello',
  'monday',
]);

export type TicketProvider = z.infer<typeof TicketProviderSchema>;

// --- Ticket Comment ---

export const TicketCommentSchema = z.object({
  author: z.string().min(1),
  body: z.string(),
  createdAt: z.coerce.date(),
});

export type TicketComment = z.infer<typeof TicketCommentSchema>;

// --- Normalized Ticket ---

export const NormalizedTicketSchema = z.object({
  provider: TicketProviderSchema,
  url: z.string().url(),
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  labels: z.array(z.string()),
  repoUrl: z.string().url().optional(),
  branch: z.string().min(1).optional(),
  comments: z.array(TicketCommentSchema),
});

export type NormalizedTicket = z.infer<typeof NormalizedTicketSchema>;
