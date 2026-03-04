import { execFile as execFileCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { ContainerInfo, ContainerCreateRequest, ContainerResources } from '@javierdpt/code-farm-shared';
import { CONTAINER_IMAGE, PODMAN_LABEL_PREFIX } from '@javierdpt/code-farm-shared';
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
  private opsLogCallback?: (level: 'info' | 'warn' | 'error', message: string, command?: string) => void;

  setWorkerId(id: string): void {
    this.workerId = id;
  }

  setOpsLogCallback(cb: (level: 'info' | 'warn' | 'error', message: string, command?: string) => void): void {
    this.opsLogCallback = cb;
  }

  private emitOpsLog(level: 'info' | 'warn' | 'error', message: string, command?: string): void {
    this.opsLogCallback?.(level, message, command);
  }

  /**
   * Create and start a new container based on the given request.
   * The container runs `sleep infinity` to stay alive for interactive use.
   */
  async create(request: ContainerCreateRequest): Promise<ContainerInfo> {
    const shortId = randomBytes(4).toString('hex');

    const image = request.image || config.containerImage || CONTAINER_IMAGE;

    let containerName: string;
    if (request.name) {
      containerName = request.name;
    } else if (request.ticketUrl) {
      // Naming: <image-name>-<provider>-<owner>-<repo>-<ticketid>
      const imageName = image.split('/').pop()?.split(':')[0] ?? 'cf';
      const { provider, owner, repo, id } = this.parseTicketUrl(request.ticketUrl);
      const repoSlug = repo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      containerName = `${imageName}-${provider}-${owner}-${repoSlug}-${id}`;
    } else {
      containerName = `cf-empty-${shortId}`;
    }
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

    // Memory limit
    if (request.memoryMb) {
      args.push('-m', `${request.memoryMb}m`);
    }

    // Extra podman arguments
    if (request.podmanArgs?.length) {
      for (const { flag, value } of request.podmanArgs) {
        args.push(flag, value);
      }
    }

    args.push(image, 'sleep', 'infinity');

    const extraArgsStr = request.podmanArgs?.length
      ? ' ' + request.podmanArgs.map(a => `${a.flag} ${a.value}`).join(' ')
      : '';
    const memStr = request.memoryMb ? ` -m ${request.memoryMb}m` : '';
    console.log(`[WorkerAgent] Creating container "${containerName}" from image "${image}"${memStr}${extraArgsStr}`);
    this.emitOpsLog('info', `Creating container "${containerName}"...`, `podman run -d --name ${containerName}${memStr}${extraArgsStr} ${image}`);

    try {
      const { stdout } = await execFile(config.podmanPath, args, { timeout: PODMAN_TIMEOUT });
      const containerId = stdout.trim();

      console.log(`[WorkerAgent] Container created: ${containerId.substring(0, 12)}`);
      this.emitOpsLog('info', `Container created: ${containerName} (${containerId.substring(0, 12)})`);

      // Inspect to return canonical info
      return this.inspect(containerId);
    } catch (err) {
      this.emitOpsLog('error', `Container creation failed: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Start a stopped container.
   */
  async start(containerId: string): Promise<ContainerInfo> {
    console.log(`[WorkerAgent] Starting container ${containerId.substring(0, 12)}...`);
    this.emitOpsLog('info', `Starting container ${containerId.substring(0, 12)}...`, `podman start ${containerId.substring(0, 12)}`);
    try {
      await execFile(config.podmanPath, ['start', containerId], {
        timeout: PODMAN_TIMEOUT,
      });
      console.log(`[WorkerAgent] Container started: ${containerId.substring(0, 12)}`);
      this.emitOpsLog('info', `Container started: ${containerId.substring(0, 12)}`);
      return this.inspect(containerId);
    } catch (err) {
      this.emitOpsLog('error', `Failed to start container ${containerId.substring(0, 12)}: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Stop a running container without removing it.
   */
  async stop(containerId: string): Promise<ContainerInfo> {
    console.log(`[WorkerAgent] Stopping container ${containerId.substring(0, 12)}...`);
    this.emitOpsLog('info', `Stopping container ${containerId.substring(0, 12)}...`, `podman stop --time 10 ${containerId.substring(0, 12)}`);
    try {
      await execFile(config.podmanPath, ['stop', '--time', '10', containerId], {
        timeout: PODMAN_TIMEOUT,
      });
      console.log(`[WorkerAgent] Container stopped: ${containerId.substring(0, 12)}`);
      this.emitOpsLog('info', `Container stopped: ${containerId.substring(0, 12)}`);
    } catch (err) {
      console.warn(`[WorkerAgent] Stop warning: ${(err as Error).message}`);
      this.emitOpsLog('warn', `Stop warning for ${containerId.substring(0, 12)}: ${(err as Error).message}`);
    }
    return this.inspect(containerId);
  }

  /**
   * Permanently remove a container. Stops it first if running.
   */
  async remove(containerId: string): Promise<void> {
    console.log(`[WorkerAgent] Removing container ${containerId.substring(0, 12)}...`);
    this.emitOpsLog('info', `Removing container ${containerId.substring(0, 12)}...`, `podman rm -f ${containerId.substring(0, 12)}`);
    try {
      await execFile(config.podmanPath, ['stop', '--time', '10', containerId], {
        timeout: PODMAN_TIMEOUT,
      });
    } catch {
      // Already stopped, continue to rm
    }
    try {
      await execFile(config.podmanPath, ['rm', '-f', containerId], {
        timeout: PODMAN_TIMEOUT,
      });
      console.log(`[WorkerAgent] Container removed: ${containerId.substring(0, 12)}`);
      this.emitOpsLog('info', `Container removed: ${containerId.substring(0, 12)}`);
    } catch (err) {
      console.error(`[WorkerAgent] Failed to remove container: ${(err as Error).message}`);
      this.emitOpsLog('error', `Failed to remove container ${containerId.substring(0, 12)}: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * List all containers managed by claude-farm on this worker.
   */
  async list(): Promise<ContainerInfo[]> {
    this.emitOpsLog('info', 'Listing managed containers...', `podman ps -a --filter label=${PODMAN_LABEL_PREFIX}.managed=true --format json`);
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
    this.emitOpsLog('info', 'Listing all containers...', 'podman ps -a --format json');
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
   * List all container images on this worker.
   */
  async listImages(): Promise<{ id: string; name: string; tag: string; size: number }[]> {
    this.emitOpsLog('info', 'Listing images...', 'podman images --format json');
    const { stdout } = await execFile(
      config.podmanPath,
      ['images', '--format', 'json'],
      { timeout: PODMAN_TIMEOUT },
    );

    const trimmed = stdout.trim();
    if (!trimmed || trimmed === 'null') return [];

    const images: unknown[] = JSON.parse(trimmed);
    const seen = new Set<string>();
    const result: { id: string; name: string; tag: string; size: number }[] = [];
    for (const img of images) {
      const obj = img as Record<string, unknown>;
      const allNames = (obj.Names ?? obj.names ?? []) as string[];
      const id = ((obj.Id ?? obj.ID ?? '') as string).substring(0, 12);
      const size = (obj.Size ?? obj.size ?? 0) as number;
      for (const fullName of allNames) {
        const [name = '', tag = 'latest'] = fullName.split(':');
        const key = `${name}:${tag}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ id, name, tag, size });
      }
    }
    return result;
  }

  /**
   * Build a container image from a Containerfile string.
   * Streams build output and reports completion or errors via callbacks.
   */
  async buildImage(
    dockerfile: string,
    tag: string,
    onOutput: (data: string) => void,
    onDone: (imageId: string) => void,
    onError: (error: string) => void,
  ): Promise<void> {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `Containerfile-${Date.now()}`);
    await fs.promises.writeFile(tmpFile, dockerfile);

    this.emitOpsLog('info', `Building image "${tag}"...`, `podman build -t ${tag} -f ${tmpFile}`);

    try {
      const proc = spawn(config.podmanPath, ['build', '-t', tag, '-f', tmpFile, tmpDir]);

      proc.stdout.on('data', (chunk: Buffer) => onOutput(chunk.toString()));
      proc.stderr.on('data', (chunk: Buffer) => onOutput(chunk.toString()));

      proc.on('close', (code) => {
        fs.promises.unlink(tmpFile).catch(() => {});
        if (code === 0) {
          execFileCb(config.podmanPath, ['images', '-q', tag], (err, stdout) => {
            if (err) {
              this.emitOpsLog('error', `Build succeeded but failed to get image ID: ${err.message}`);
              onError(`Build succeeded but failed to get image ID: ${err.message}`);
            } else {
              this.emitOpsLog('info', `Image built successfully: ${tag} (${stdout.trim().substring(0, 12)})`);
              onDone(stdout.trim());
            }
          });
        } else {
          this.emitOpsLog('error', `Image build failed with exit code ${code}`);
          onError(`Build failed with exit code ${code}`);
        }
      });

      proc.on('error', (err) => {
        fs.promises.unlink(tmpFile).catch(() => {});
        this.emitOpsLog('error', `Image build error: ${err.message}`);
        onError(err.message);
      });
    } catch (err: unknown) {
      fs.promises.unlink(tmpFile).catch(() => {});
      this.emitOpsLog('error', `Image build error: ${(err as Error).message}`);
      onError((err as Error).message);
    }
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
   * Parse a ticket URL into provider, owner/account, and ticket ID.
   */
  private parseTicketUrl(url: string): { provider: string; owner: string; repo: string; id: string } {
    // GitHub: https://github.com/{owner}/{repo}/issues/{number}
    const gh = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if (gh) return { provider: 'github', owner: gh[1], repo: gh[2], id: gh[3] };

    // Azure DevOps: https://dev.azure.com/{org}/{project}/_workitems/edit/{id}
    const az = url.match(/dev\.azure\.com\/([^/]+)\/([^/]+)\/_workitems\/edit\/(\d+)/);
    if (az) return { provider: 'azdo', owner: az[1], repo: az[2], id: az[3] };

    // Fallback: use sanitized URL parts
    return { provider: 'ticket', owner: '', repo: '', id: randomBytes(4).toString('hex') };
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
