import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import type { ContainerInfo, ContainerCreateRequest } from '@code-farm/shared';
import { CONTAINER_IMAGE, PODMAN_LABEL_PREFIX } from '@code-farm/shared';
import { config } from './config.js';

const execFile = promisify(execFileCb);

/** Maximum time (ms) to wait for a podman command to complete. */
const PODMAN_TIMEOUT = 60_000;

/**
 * Wraps the Podman CLI to manage containers with the claude-farm label
 * convention. All operations shell out to the `podman` binary.
 */
export class ContainerManager {
  private workerId = '';

  setWorkerId(id: string): void {
    this.workerId = id;
  }

  /**
   * Create and start a new container based on the given request.
   * The container runs `sleep infinity` to stay alive for interactive use.
   */
  async create(request: ContainerCreateRequest): Promise<ContainerInfo> {
    const shortId = randomBytes(4).toString('hex');
    const sanitizedTitle = request.ticketTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40);
    const containerName = `cf-${sanitizedTitle}-${shortId}`;

    const image = request.image || config.containerImage || CONTAINER_IMAGE;
    const createdAt = new Date().toISOString();
    const workerName = request.workerName || config.workerName;

    const args: string[] = [
      'run',
      '-d',
      '--name', containerName,
      '--label', `${PODMAN_LABEL_PREFIX}.managed=true`,
      '--label', `${PODMAN_LABEL_PREFIX}.ticket-url=${request.ticketUrl}`,
      '--label', `${PODMAN_LABEL_PREFIX}.ticket-title=${request.ticketTitle}`,
      '--label', `${PODMAN_LABEL_PREFIX}.repo-url=${request.repoUrl}`,
      '--label', `${PODMAN_LABEL_PREFIX}.branch=${request.branch}`,
      '--label', `${PODMAN_LABEL_PREFIX}.created-at=${createdAt}`,
      '--label', `${PODMAN_LABEL_PREFIX}.worker-id=${this.workerId}`,
      '--label', `${PODMAN_LABEL_PREFIX}.worker-name=${workerName}`,
      image,
      'sleep', 'infinity',
    ];

    console.log(`[WorkerAgent] Creating container "${containerName}" from image "${image}"`);

    const { stdout } = await execFile('podman', args, { timeout: PODMAN_TIMEOUT });
    const containerId = stdout.trim();

    console.log(`[WorkerAgent] Container created: ${containerId.substring(0, 12)}`);

    // Inspect to return canonical info
    return this.inspect(containerId);
  }

  /**
   * Stop and remove a container.
   */
  async stop(containerId: string): Promise<void> {
    console.log(`[WorkerAgent] Stopping container ${containerId.substring(0, 12)}...`);

    try {
      await execFile('podman', ['stop', '--time', '10', containerId], {
        timeout: PODMAN_TIMEOUT,
      });
    } catch (err) {
      // Container may already be stopped; log but continue to rm
      console.warn(`[WorkerAgent] Stop warning: ${(err as Error).message}`);
    }

    try {
      await execFile('podman', ['rm', '-f', containerId], {
        timeout: PODMAN_TIMEOUT,
      });
      console.log(`[WorkerAgent] Container removed: ${containerId.substring(0, 12)}`);
    } catch (err) {
      console.error(`[WorkerAgent] Failed to remove container: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * List all containers managed by claude-farm on this worker.
   */
  async list(): Promise<ContainerInfo[]> {
    const { stdout } = await execFile(
      'podman',
      [
        'ps',
        '-a',
        '--filter', `label=${PODMAN_LABEL_PREFIX}.managed=true`,
        '--format', 'json',
      ],
      { timeout: PODMAN_TIMEOUT },
    );

    const trimmed = stdout.trim();
    if (!trimmed || trimmed === 'null') return [];

    const containers: unknown[] = JSON.parse(trimmed);
    return containers.map((c) => this.parsePodmanContainer(c));
  }

  /**
   * Inspect a single container and return its info.
   */
  async inspect(containerId: string): Promise<ContainerInfo> {
    const { stdout } = await execFile(
      'podman',
      ['inspect', '--format', 'json', containerId],
      { timeout: PODMAN_TIMEOUT },
    );

    const parsed: unknown[] = JSON.parse(stdout.trim());
    if (!parsed.length) {
      throw new Error(`Container not found: ${containerId}`);
    }

    return this.parsePodmanInspect(parsed[0]);
  }

  /**
   * Execute a command inside a running container (non-interactive).
   * Returns the combined stdout output.
   */
  async exec(containerId: string, command: string[]): Promise<string> {
    const { stdout } = await execFile(
      'podman',
      ['exec', containerId, ...command],
      { timeout: PODMAN_TIMEOUT },
    );

    return stdout;
  }

  /**
   * Return the number of running containers managed by claude-farm.
   */
  async runningCount(): Promise<number> {
    const { stdout } = await execFile(
      'podman',
      [
        'ps',
        '--filter', `label=${PODMAN_LABEL_PREFIX}.managed=true`,
        '--filter', 'status=running',
        '--format', '{{.ID}}',
      ],
      { timeout: PODMAN_TIMEOUT },
    );

    const trimmed = stdout.trim();
    if (!trimmed) return 0;
    return trimmed.split('\n').length;
  }

  // ---------------------------------------------------------------------------
  // Private - Podman JSON parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse the JSON output of `podman ps --format json` into ContainerInfo.
   */
  private parsePodmanContainer(json: unknown): ContainerInfo {
    const obj = json as Record<string, unknown>;
    const labels = (obj.Labels ?? {}) as Record<string, string>;
    const status = this.mapPodmanState(obj.State as string | undefined);

    return {
      id: (obj.Id ?? obj.ID ?? '') as string,
      name: this.extractName(obj),
      status,
      workerId: labels[`${PODMAN_LABEL_PREFIX}.worker-id`] ?? this.workerId,
      workerName: labels[`${PODMAN_LABEL_PREFIX}.worker-name`] ?? config.workerName,
      ticketUrl: labels[`${PODMAN_LABEL_PREFIX}.ticket-url`] ?? '',
      ticketTitle: labels[`${PODMAN_LABEL_PREFIX}.ticket-title`] ?? '',
      repoUrl: labels[`${PODMAN_LABEL_PREFIX}.repo-url`] ?? '',
      branch: labels[`${PODMAN_LABEL_PREFIX}.branch`] ?? '',
      createdAt: new Date(
        labels[`${PODMAN_LABEL_PREFIX}.created-at`] ??
          (obj.Created as string | undefined) ??
          Date.now(),
      ),
      image: (obj.Image ?? '') as string,
    };
  }

  /**
   * Parse the JSON output of `podman inspect` into ContainerInfo.
   */
  private parsePodmanInspect(json: unknown): ContainerInfo {
    const obj = json as Record<string, unknown>;
    const config_ = (obj.Config ?? {}) as Record<string, unknown>;
    const state = (obj.State ?? {}) as Record<string, unknown>;
    const labels = (config_.Labels ?? {}) as Record<string, string>;
    const status = this.mapPodmanState(state.Status as string | undefined);

    return {
      id: (obj.Id ?? '') as string,
      name: ((obj.Name ?? '') as string).replace(/^\//, ''),
      status,
      workerId: labels[`${PODMAN_LABEL_PREFIX}.worker-id`] ?? this.workerId,
      workerName: labels[`${PODMAN_LABEL_PREFIX}.worker-name`] ?? config.workerName,
      ticketUrl: labels[`${PODMAN_LABEL_PREFIX}.ticket-url`] ?? '',
      ticketTitle: labels[`${PODMAN_LABEL_PREFIX}.ticket-title`] ?? '',
      repoUrl: labels[`${PODMAN_LABEL_PREFIX}.repo-url`] ?? '',
      branch: labels[`${PODMAN_LABEL_PREFIX}.branch`] ?? '',
      createdAt: new Date(
        labels[`${PODMAN_LABEL_PREFIX}.created-at`] ??
          (obj.Created as string | undefined) ??
          Date.now(),
      ),
      image: (config_.Image ?? '') as string,
    };
  }

  /**
   * Extract the container name from `podman ps` JSON, which may store it
   * as a string or an array of strings.
   */
  private extractName(obj: Record<string, unknown>): string {
    const names = obj.Names ?? obj.Name;
    if (Array.isArray(names)) return (names[0] ?? '') as string;
    return ((names ?? '') as string).replace(/^\//, '');
  }

  /**
   * Map podman state strings to our ContainerStatus enum.
   */
  private mapPodmanState(
    state: string | undefined,
  ): 'creating' | 'running' | 'stopped' | 'error' | 'removing' {
    switch (state?.toLowerCase()) {
      case 'running':
        return 'running';
      case 'created':
      case 'initialized':
        return 'creating';
      case 'exited':
      case 'stopped':
      case 'dead':
        return 'stopped';
      case 'removing':
        return 'removing';
      default:
        return 'stopped';
    }
  }
}
