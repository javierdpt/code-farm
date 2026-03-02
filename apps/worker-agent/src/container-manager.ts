import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import type { ContainerInfo, ContainerCreateRequest, ContainerResources } from '@code-farm/shared';
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

    let containerName: string;
    if (request.name) {
      containerName = request.name;
    } else if (request.ticketTitle) {
      const sanitizedTitle = request.ticketTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40);
      containerName = `cf-${sanitizedTitle}-${shortId}`;
    } else {
      containerName = `cf-empty-${shortId}`;
    }

    const image = request.image || config.containerImage || CONTAINER_IMAGE;
    const createdAt = new Date().toISOString();
    const workerName = request.workerName || config.workerName;

    const args: string[] = [
      'run',
      '-d',
      '--name', containerName,
      '--label', `${PODMAN_LABEL_PREFIX}.managed=true`,
      '--label', `${PODMAN_LABEL_PREFIX}.created-at=${createdAt}`,
      '--label', `${PODMAN_LABEL_PREFIX}.worker-id=${this.workerId}`,
      '--label', `${PODMAN_LABEL_PREFIX}.worker-name=${workerName}`,
    ];

    if (request.ticketUrl) {
      args.push('--label', `${PODMAN_LABEL_PREFIX}.ticket-url=${request.ticketUrl}`);
    }
    if (request.ticketTitle) {
      args.push('--label', `${PODMAN_LABEL_PREFIX}.ticket-title=${request.ticketTitle}`);
    }
    if (request.repoUrl) {
      args.push('--label', `${PODMAN_LABEL_PREFIX}.repo-url=${request.repoUrl}`);
    }
    if (request.branch) {
      args.push('--label', `${PODMAN_LABEL_PREFIX}.branch=${request.branch}`);
    }

    args.push(image, 'sleep', 'infinity');

    console.log(`[WorkerAgent] Creating container "${containerName}" from image "${image}"`);

    const { stdout } = await execFile('podman', args, { timeout: PODMAN_TIMEOUT });
    const containerId = stdout.trim();

    console.log(`[WorkerAgent] Container created: ${containerId.substring(0, 12)}`);

    // Inspect to return canonical info
    return this.inspect(containerId);
  }

  /**
   * Start a stopped container.
   */
  async start(containerId: string): Promise<ContainerInfo> {
    console.log(`[WorkerAgent] Starting container ${containerId.substring(0, 12)}...`);
    await execFile('podman', ['start', containerId], {
      timeout: PODMAN_TIMEOUT,
    });
    console.log(`[WorkerAgent] Container started: ${containerId.substring(0, 12)}`);
    return this.inspect(containerId);
  }

  /**
   * Stop a running container without removing it.
   */
  async stop(containerId: string): Promise<ContainerInfo> {
    console.log(`[WorkerAgent] Stopping container ${containerId.substring(0, 12)}...`);
    try {
      await execFile('podman', ['stop', '--time', '10', containerId], {
        timeout: PODMAN_TIMEOUT,
      });
      console.log(`[WorkerAgent] Container stopped: ${containerId.substring(0, 12)}`);
    } catch (err) {
      console.warn(`[WorkerAgent] Stop warning: ${(err as Error).message}`);
    }
    return this.inspect(containerId);
  }

  /**
   * Permanently remove a container. Stops it first if running.
   */
  async remove(containerId: string): Promise<void> {
    console.log(`[WorkerAgent] Removing container ${containerId.substring(0, 12)}...`);
    try {
      await execFile('podman', ['stop', '--time', '10', containerId], {
        timeout: PODMAN_TIMEOUT,
      });
    } catch {
      // Already stopped, continue to rm
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
   * List ALL containers on this worker (no label filter).
   * Sets `managed` flag based on presence of the claude-farm label.
   * Includes batch resource stats for all containers.
   */
  async listAll(): Promise<ContainerInfo[]> {
    const { stdout } = await execFile(
      'podman',
      ['ps', '-a', '--format', 'json'],
      { timeout: PODMAN_TIMEOUT },
    );

    const trimmed = stdout.trim();
    if (!trimmed || trimmed === 'null') return [];

    const containers: unknown[] = JSON.parse(trimmed);
    const result = containers.map((c) => this.parsePodmanContainer(c));

    // Batch-fetch stats for all containers (best-effort)
    try {
      const statsMap = await this.batchStats();
      for (const container of result) {
        const stats = statsMap.get(container.id);
        if (stats) container.resources = stats;
      }
    } catch {
      // Stats unavailable - return containers without resources
    }

    return result;
  }

  /**
   * Inspect a single container and return its info.
   * Does NOT fetch resource stats - use inspectWithStats() for that.
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
   * Inspect a single container and include resource stats (CPU, memory, disk).
   * Slower than inspect() due to extra podman calls.
   */
  async inspectWithStats(containerId: string): Promise<ContainerInfo> {
    const info = await this.inspect(containerId);

    try {
      info.resources = await this.stats(containerId);
    } catch {
      // Stats unavailable - leave resources undefined
    }

    return info;
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
   * Return the number of all running containers on this worker.
   */
  async runningCount(): Promise<number> {
    const { stdout } = await execFile(
      'podman',
      [
        'ps',
        '--filter', 'status=running',
        '--format', '{{.ID}}',
      ],
      { timeout: PODMAN_TIMEOUT },
    );

    const trimmed = stdout.trim();
    if (!trimmed) return 0;
    return trimmed.split('\n').length;
  }

  /**
   * Get resource stats for a container (configured limits + live usage).
   */
  async stats(containerId: string): Promise<ContainerResources> {
    // Get configured limits from inspect
    const { stdout: inspectOut } = await execFile(
      'podman',
      ['inspect', '--format', 'json', containerId],
      { timeout: PODMAN_TIMEOUT },
    );
    const inspectData: unknown[] = JSON.parse(inspectOut.trim());
    const obj = (inspectData[0] ?? {}) as Record<string, unknown>;
    const hostConfig = (obj.HostConfig ?? {}) as Record<string, unknown>;
    const state = (obj.State ?? {}) as Record<string, unknown>;

    const memoryLimit = (hostConfig.Memory ?? 0) as number;
    const cpuLimit = (hostConfig.NanoCpus ?? 0) as number;

    // Get disk size via podman ps --size
    let diskUsage = 0;
    try {
      const { stdout: psOut } = await execFile(
        'podman',
        ['ps', '-a', '--size', '--filter', `id=${containerId}`, '--format', '{{.Size}}'],
        { timeout: PODMAN_TIMEOUT },
      );
      diskUsage = this.parseSizeString(psOut.trim());
    } catch {
      // Disk size is best-effort
    }

    // Get live CPU/memory usage (only for running containers)
    let memoryUsage = 0;
    let cpuPercent = 0;

    if ((state.Status as string)?.toLowerCase() === 'running') {
      try {
        const { stdout: statsOut } = await execFile(
          'podman',
          ['stats', '--no-stream', '--format', 'json', containerId],
          { timeout: PODMAN_TIMEOUT },
        );
        const statsData: unknown[] = JSON.parse(statsOut.trim());
        if (statsData.length) {
          const s = statsData[0] as Record<string, unknown>;
          cpuPercent = parseFloat(String(s.cpu_percent ?? s.CPU ?? '0').replace('%', ''));
          if (typeof s.mem_usage === 'number') {
            memoryUsage = s.mem_usage;
          } else if (typeof s.MemUsage === 'string') {
            memoryUsage = this.parseSizeString(s.MemUsage.split('/')[0].trim());
          }
        }
      } catch {
        // Stats unavailable
      }
    }

    return { memoryLimit, cpuLimit, diskUsage, memoryUsage, cpuPercent };
  }

  /**
   * Batch-fetch resource stats for ALL containers in a single set of podman calls.
   * Much more efficient than calling stats() per container.
   */
  async batchStats(): Promise<Map<string, ContainerResources>> {
    const result = new Map<string, ContainerResources>();

    // 1. Get disk sizes for all containers via podman ps --size
    // Size is an object: { rootFsSize: number, rwSize: number }
    const diskMap = new Map<string, number>();
    try {
      const { stdout: psOut } = await execFile(
        'podman',
        ['ps', '-a', '--size', '--format', 'json'],
        { timeout: PODMAN_TIMEOUT },
      );
      const psData: unknown[] = JSON.parse(psOut.trim() || '[]');
      for (const item of psData) {
        const obj = item as Record<string, unknown>;
        const id = (obj.Id ?? obj.ID ?? '') as string;
        const sizeObj = obj.Size as Record<string, unknown> | undefined;
        const diskUsage = typeof sizeObj === 'object' && sizeObj !== null
          ? ((sizeObj.rwSize ?? 0) as number)
          : 0;
        if (id) diskMap.set(id, diskUsage);
      }
    } catch {
      // Disk stats unavailable
    }

    // 2. Get live CPU/memory for running containers via podman stats
    // Note: stats returns truncated IDs (12 chars) in the 'id' field
    const liveMap = new Map<string, { cpuPercent: number; memoryUsage: number }>();
    try {
      const { stdout: statsOut } = await execFile(
        'podman',
        ['stats', '--no-stream', '--format', 'json'],
        { timeout: PODMAN_TIMEOUT },
      );
      const statsData: unknown[] = JSON.parse(statsOut.trim() || '[]');
      for (const item of statsData) {
        const s = item as Record<string, unknown>;
        const shortId = (s.id ?? s.ID ?? s.Id ?? '') as string;
        const cpuPercent = parseFloat(String(s.cpu_percent ?? s.CPU ?? '0').replace('%', ''));
        let memoryUsage = 0;
        if (typeof s.mem_usage === 'number') {
          memoryUsage = s.mem_usage;
        } else if (typeof s.mem_usage === 'string') {
          memoryUsage = this.parseSizeString(s.mem_usage.split('/')[0].trim());
        } else if (typeof s.MemUsage === 'string') {
          memoryUsage = this.parseSizeString(s.MemUsage.split('/')[0].trim());
        }
        if (shortId) liveMap.set(shortId, { cpuPercent, memoryUsage });
      }
    } catch {
      // Live stats unavailable
    }

    // 3. Merge into results - match live stats by prefix since stats uses short IDs
    for (const [fullId, diskUsage] of diskMap) {
      const live = this.findByPrefix(liveMap, fullId);
      result.set(fullId, {
        memoryLimit: 0,
        cpuLimit: 0,
        diskUsage,
        memoryUsage: live?.memoryUsage ?? 0,
        cpuPercent: live?.cpuPercent ?? 0,
      });
    }

    // Add any live-only entries (shouldn't happen, but be safe)
    for (const [shortId, live] of liveMap) {
      const fullId = this.findFullId(diskMap, shortId);
      if (fullId && !result.has(fullId)) {
        result.set(fullId, {
          memoryLimit: 0,
          cpuLimit: 0,
          diskUsage: 0,
          memoryUsage: live.memoryUsage,
          cpuPercent: live.cpuPercent,
        });
      }
    }

    return result;
  }

  /**
   * Find a value in a map where the key is a short prefix of the search ID.
   */
  private findByPrefix<T>(map: Map<string, T>, fullId: string): T | undefined {
    // Try exact match first
    const exact = map.get(fullId);
    if (exact) return exact;
    // Try prefix match (stats returns 12-char IDs)
    for (const [key, value] of map) {
      if (fullId.startsWith(key) || key.startsWith(fullId)) return value;
    }
    return undefined;
  }

  /**
   * Find the full ID in a map that matches a short prefix.
   */
  private findFullId(map: Map<string, unknown>, shortId: string): string | undefined {
    for (const key of map.keys()) {
      if (key.startsWith(shortId)) return key;
    }
    return undefined;
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
    const managed = labels[`${PODMAN_LABEL_PREFIX}.managed`] === 'true';

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
      managed,
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
    const managed = labels[`${PODMAN_LABEL_PREFIX}.managed`] === 'true';

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
      managed,
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

  /**
   * Parse a human-readable size string (e.g. "123.4MiB", "1.2 GB") into bytes.
   */
  private parseSizeString(str: string): number {
    const match = str.match(/^([\d.]+)\s*(B|KiB|MiB|GiB|TiB|KB|MB|GB|TB)?/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = (match[2] ?? 'B').toUpperCase();
    const multipliers: Record<string, number> = {
      B: 1,
      KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3, TIB: 1024 ** 4,
      KB: 1000, MB: 1000 ** 2, GB: 1000 ** 3, TB: 1000 ** 4,
    };
    return value * (multipliers[unit] ?? 1);
  }
}
