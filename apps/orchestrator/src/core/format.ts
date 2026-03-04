/**
 * Format a date as a relative time string (e.g., "5s ago", "3m ago", "2h ago").
 */
export function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const diffMs = now - then;

  if (diffMs < 0) {
    return 'just now';
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format bytes into a human-readable string (e.g., "8.0 GB").
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(1)} ${units[i]}`;
}

/**
 * Truncate a string to a maximum length with an ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '\u2026';
}

/**
 * Parse a container name into structured segments.
 * Convention: <image>-<provider>-<owner>-<repo>-<id>
 * Also handles: cf-empty-<hex> and other patterns.
 */
export interface ContainerNameParts {
  image: string;
  provider?: string;
  owner?: string;
  repo?: string;
  ticketId?: string;
}

export function parseContainerName(name: string): ContainerNameParts {
  // Match: <image>-<provider>-<owner>-<repo>-<ticketId>
  const match = name.match(/^(.+?)-(github|azdo|ticket)-([^-]+)-([^-]+)-(\d+)$/);
  if (match) {
    return { image: match[1], provider: match[2], owner: match[3], repo: match[4], ticketId: match[5] };
  }
  // Fallback: just the raw name
  return { image: name };
}
