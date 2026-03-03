import { z } from 'zod';
import { ContainerInfoSchema, ContainerCreateRequestSchema } from './container.js';

// ============================================================
// Worker-to-Orchestrator Messages
// ============================================================

// --- worker.register ---

export const WorkerRegisterMessageSchema = z.object({
  type: z.literal('worker.register'),
  name: z.string().min(1),
  hostname: z.string().min(1),
  platform: z.string().min(1),
  cpuCount: z.number().int().positive(),
  memoryTotal: z.number().positive(),
});

export type WorkerRegisterMessage = z.infer<typeof WorkerRegisterMessageSchema>;

// --- worker.heartbeat ---

export const WorkerHeartbeatMessageSchema = z.object({
  type: z.literal('worker.heartbeat'),
  cpuUsage: z.number().nonnegative(),
  memoryFree: z.number().nonnegative(),
  diskTotal: z.number().nonnegative().optional(),
  diskFree: z.number().nonnegative().optional(),
  containersRunning: z.number().int().nonnegative(),
});

export type WorkerHeartbeatMessage = z.infer<typeof WorkerHeartbeatMessageSchema>;

// --- container.created ---

export const ContainerCreatedMessageSchema = z.object({
  type: z.literal('container.created'),
  requestId: z.string().min(1),
  container: ContainerInfoSchema,
});

export type ContainerCreatedMessage = z.infer<typeof ContainerCreatedMessageSchema>;

// --- container.started ---

export const ContainerStartedMessageSchema = z.object({
  type: z.literal('container.started'),
  requestId: z.string().min(1),
  container: ContainerInfoSchema,
});

export type ContainerStartedMessage = z.infer<typeof ContainerStartedMessageSchema>;

// --- container.stopped ---

export const ContainerStoppedMessageSchema = z.object({
  type: z.literal('container.stopped'),
  requestId: z.string().min(1),
  containerId: z.string().min(1),
  container: ContainerInfoSchema.optional(),
});

export type ContainerStoppedMessage = z.infer<typeof ContainerStoppedMessageSchema>;

// --- container.removed ---

export const ContainerRemovedMessageSchema = z.object({
  type: z.literal('container.removed'),
  requestId: z.string().min(1),
  containerId: z.string().min(1),
});

export type ContainerRemovedMessage = z.infer<typeof ContainerRemovedMessageSchema>;

// --- container.list.response ---

export const ContainerListResponseMessageSchema = z.object({
  type: z.literal('container.list.response'),
  requestId: z.string().min(1),
  containers: z.array(ContainerInfoSchema),
});

export type ContainerListResponseMessage = z.infer<typeof ContainerListResponseMessageSchema>;

// --- container.list-all.response ---

export const ContainerListAllResponseMessageSchema = z.object({
  type: z.literal('container.list-all.response'),
  requestId: z.string().min(1),
  containers: z.array(ContainerInfoSchema),
});

export type ContainerListAllResponseMessage = z.infer<typeof ContainerListAllResponseMessageSchema>;

// --- terminal.opened ---

export const TerminalOpenedMessageSchema = z.object({
  type: z.literal('terminal.opened'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
});

export type TerminalOpenedMessage = z.infer<typeof TerminalOpenedMessageSchema>;

// --- terminal.output ---

export const TerminalOutputMessageSchema = z.object({
  type: z.literal('terminal.output'),
  sessionId: z.string().min(1),
  data: z.string(), // base64 encoded
});

export type TerminalOutputMessage = z.infer<typeof TerminalOutputMessageSchema>;

// --- terminal.closed ---

export const TerminalClosedMessageSchema = z.object({
  type: z.literal('terminal.closed'),
  sessionId: z.string().min(1),
  exitCode: z.number().int().optional(),
});

export type TerminalClosedMessage = z.infer<typeof TerminalClosedMessageSchema>;

// --- ops.log ---

export const OpsLogMessageSchema = z.object({
  type: z.literal('ops.log'),
  timestamp: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  message: z.string(),
  command: z.string().optional(),
});

export type OpsLogMessage = z.infer<typeof OpsLogMessageSchema>;

// --- image.build.output ---

export const ImageBuildOutputMessageSchema = z.object({
  type: z.literal('image.build.output'),
  requestId: z.string(),
  data: z.string(),
});

export type ImageBuildOutputMessage = z.infer<typeof ImageBuildOutputMessageSchema>;

// --- image.build.done ---

export const ImageBuildDoneMessageSchema = z.object({
  type: z.literal('image.build.done'),
  requestId: z.string(),
  imageId: z.string(),
  tag: z.string(),
});

export type ImageBuildDoneMessage = z.infer<typeof ImageBuildDoneMessageSchema>;

// --- image.build.error ---

export const ImageBuildErrorMessageSchema = z.object({
  type: z.literal('image.build.error'),
  requestId: z.string(),
  error: z.string(),
});

export type ImageBuildErrorMessage = z.infer<typeof ImageBuildErrorMessageSchema>;

// --- images.list.response ---

export const ImageInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  tag: z.string(),
  size: z.number(),
});

export type ImageInfo = z.infer<typeof ImageInfoSchema>;

export const ImagesListResponseMessageSchema = z.object({
  type: z.literal('images.list.response'),
  requestId: z.string().min(1),
  images: z.array(ImageInfoSchema),
});

export type ImagesListResponseMessage = z.infer<typeof ImagesListResponseMessageSchema>;

// --- Error responses ---

const workerErrorBase = {
  requestId: z.string().min(1),
  error: z.string(),
  containerId: z.string().optional(),
};

export const ContainerCreateErrorSchema = z.object({ type: z.literal('container.create.error'), ...workerErrorBase });
export const ContainerStartErrorSchema = z.object({ type: z.literal('container.start.error'), ...workerErrorBase });
export const ContainerStopErrorSchema = z.object({ type: z.literal('container.stop.error'), ...workerErrorBase });
export const ContainerRemoveErrorSchema = z.object({ type: z.literal('container.remove.error'), ...workerErrorBase });
export const ContainerListErrorSchema = z.object({ type: z.literal('container.list.error'), ...workerErrorBase });
export const ContainerListAllErrorSchema = z.object({ type: z.literal('container.list-all.error'), ...workerErrorBase });
export const TerminalOpenErrorSchema = z.object({ type: z.literal('terminal.open.error'), ...workerErrorBase });
export const ImagesListErrorSchema = z.object({ type: z.literal('images.list.error'), ...workerErrorBase });

export type WorkerErrorMessage =
  | z.infer<typeof ContainerCreateErrorSchema>
  | z.infer<typeof ContainerStartErrorSchema>
  | z.infer<typeof ContainerStopErrorSchema>
  | z.infer<typeof ContainerRemoveErrorSchema>
  | z.infer<typeof ContainerListErrorSchema>
  | z.infer<typeof ContainerListAllErrorSchema>
  | z.infer<typeof TerminalOpenErrorSchema>
  | z.infer<typeof ImagesListErrorSchema>;

// --- Worker Message (discriminated union) ---

export const WorkerMessageSchema = z.discriminatedUnion('type', [
  WorkerRegisterMessageSchema,
  WorkerHeartbeatMessageSchema,
  ContainerCreatedMessageSchema,
  ContainerStartedMessageSchema,
  ContainerStoppedMessageSchema,
  ContainerRemovedMessageSchema,
  ContainerListResponseMessageSchema,
  ContainerListAllResponseMessageSchema,
  TerminalOpenedMessageSchema,
  TerminalOutputMessageSchema,
  TerminalClosedMessageSchema,
  OpsLogMessageSchema,
  ImageBuildOutputMessageSchema,
  ImageBuildDoneMessageSchema,
  ImageBuildErrorMessageSchema,
  ContainerCreateErrorSchema,
  ContainerStartErrorSchema,
  ContainerStopErrorSchema,
  ContainerRemoveErrorSchema,
  ContainerListErrorSchema,
  ContainerListAllErrorSchema,
  TerminalOpenErrorSchema,
  ImagesListResponseMessageSchema,
  ImagesListErrorSchema,
]);

export type WorkerMessage = z.infer<typeof WorkerMessageSchema>;

// ============================================================
// Orchestrator-to-Worker Messages
// ============================================================

// --- worker.accepted ---

export const WorkerAcceptedMessageSchema = z.object({
  type: z.literal('worker.accepted'),
  workerId: z.string().min(1),
});

export type WorkerAcceptedMessage = z.infer<typeof WorkerAcceptedMessageSchema>;

// --- container.create ---

export const ContainerCreateMessageSchema = z.object({
  type: z.literal('container.create'),
  requestId: z.string().min(1),
  config: ContainerCreateRequestSchema,
});

export type ContainerCreateMessage = z.infer<typeof ContainerCreateMessageSchema>;

// --- container.start ---

export const ContainerStartMessageSchema = z.object({
  type: z.literal('container.start'),
  requestId: z.string().min(1),
  containerId: z.string().min(1),
});

export type ContainerStartMessage = z.infer<typeof ContainerStartMessageSchema>;

// --- container.stop ---

export const ContainerStopMessageSchema = z.object({
  type: z.literal('container.stop'),
  requestId: z.string().min(1),
  containerId: z.string().min(1),
});

export type ContainerStopMessage = z.infer<typeof ContainerStopMessageSchema>;

// --- container.remove ---

export const ContainerRemoveMessageSchema = z.object({
  type: z.literal('container.remove'),
  requestId: z.string().min(1),
  containerId: z.string().min(1),
});

export type ContainerRemoveMessage = z.infer<typeof ContainerRemoveMessageSchema>;

// --- container.list ---

export const ContainerListMessageSchema = z.object({
  type: z.literal('container.list'),
  requestId: z.string().min(1),
});

export type ContainerListMessage = z.infer<typeof ContainerListMessageSchema>;

// --- container.list-all ---

export const ContainerListAllMessageSchema = z.object({
  type: z.literal('container.list-all'),
  requestId: z.string().min(1),
});

export type ContainerListAllMessage = z.infer<typeof ContainerListAllMessageSchema>;

// --- images.list ---

export const ImagesListMessageSchema = z.object({
  type: z.literal('images.list'),
  requestId: z.string().min(1),
});

export type ImagesListMessage = z.infer<typeof ImagesListMessageSchema>;

// --- image.build ---

export const ImageBuildMessageSchema = z.object({
  type: z.literal('image.build'),
  requestId: z.string(),
  dockerfile: z.string(),
  tag: z.string(),
});

export type ImageBuildMessage = z.infer<typeof ImageBuildMessageSchema>;

// --- terminal.open ---

export const TerminalOpenMessageSchema = z.object({
  type: z.literal('terminal.open'),
  requestId: z.string().min(1),
  containerId: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export type TerminalOpenMessage = z.infer<typeof TerminalOpenMessageSchema>;

// --- terminal.input ---

export const TerminalInputMessageSchema = z.object({
  type: z.literal('terminal.input'),
  sessionId: z.string().min(1),
  data: z.string(), // base64 encoded
});

export type TerminalInputMessage = z.infer<typeof TerminalInputMessageSchema>;

// --- terminal.resize ---

export const TerminalResizeMessageSchema = z.object({
  type: z.literal('terminal.resize'),
  sessionId: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export type TerminalResizeMessage = z.infer<typeof TerminalResizeMessageSchema>;

// --- terminal.close ---

export const TerminalCloseMessageSchema = z.object({
  type: z.literal('terminal.close'),
  sessionId: z.string().min(1),
});

export type TerminalCloseMessage = z.infer<typeof TerminalCloseMessageSchema>;

// --- Orchestrator Message (discriminated union) ---

export const OrchestratorMessageSchema = z.discriminatedUnion('type', [
  WorkerAcceptedMessageSchema,
  ContainerCreateMessageSchema,
  ContainerStartMessageSchema,
  ContainerStopMessageSchema,
  ContainerRemoveMessageSchema,
  ContainerListMessageSchema,
  ContainerListAllMessageSchema,
  ImageBuildMessageSchema,
  TerminalOpenMessageSchema,
  TerminalInputMessageSchema,
  TerminalResizeMessageSchema,
  TerminalCloseMessageSchema,
  ImagesListMessageSchema,
]);

export type OrchestratorMessage = z.infer<typeof OrchestratorMessageSchema>;

// ============================================================
// Browser-to-Orchestrator Terminal Messages
// ============================================================

// --- terminal.browser.resize ---

export const TerminalBrowserResizeMessageSchema = z.object({
  type: z.literal('terminal.browser.resize'),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export type TerminalBrowserResizeMessage = z.infer<typeof TerminalBrowserResizeMessageSchema>;

export const BrowserTerminalMessageSchema = z.discriminatedUnion('type', [
  TerminalBrowserResizeMessageSchema,
]);

export type BrowserTerminalMessage = z.infer<typeof BrowserTerminalMessageSchema>;
