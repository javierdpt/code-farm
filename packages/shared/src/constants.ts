export const CONTAINER_IMAGE = 'localhost/claude-code-dev:latest';
export const HEARTBEAT_INTERVAL = 10_000;
export const HEARTBEAT_TIMEOUT = 30_000;
export const RECONNECT_BASE_DELAY = 1_000;
export const RECONNECT_MAX_DELAY = 30_000;
export const PODMAN_LABEL_PREFIX = 'claude-farm';
export const WS_PATHS = {
  WORKER: '/ws/worker',
  TERMINAL: '/ws/terminal',
} as const;
