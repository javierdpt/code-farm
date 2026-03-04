import { ContainerManager } from './container-manager.js';

/**
 * Build an authenticated clone URL by embedding a PAT token.
 * e.g. https://github.com/owner/repo → https://x-access-token:TOKEN@github.com/owner/repo
 */
function authenticatedUrl(repoUrl: string, token: string): string {
  try {
    const url = new URL(repoUrl);
    url.username = 'x-access-token';
    url.password = token;
    return url.toString();
  } catch {
    return repoUrl;
  }
}

export interface SetupRepoResult {
  cloned: boolean;
  method?: 'gh' | 'pat' | 'git';
  error?: string;
}

/**
 * Clone a repository inside a container and optionally write a CLAUDE.md file.
 *
 * Clone strategy (in order):
 *   1. `gh repo clone` — uses gh CLI auth if available
 *   2. `git clone` with PAT embedded in URL — if gitToken is provided
 *   3. `git clone` unauthenticated — for public repos
 *
 * If all methods fail, the container is left running without a repo.
 */
export async function setupRepo(
  containerManager: ContainerManager,
  containerId: string,
  repoUrl: string,
  branch: string | undefined,
  claudeMd: string | undefined,
  gitToken: string | undefined,
): Promise<SetupRepoResult> {
  const shortId = containerId.substring(0, 12);

  console.log(
    `[WorkerAgent] Setting up repo in container ${shortId}: ${repoUrl}${gitToken ? ' (token provided)' : ''}`,
  );

  // 0. Detect workspace path (use $HOME/workspace to avoid permission issues)
  let workspace = '/workspace';
  try {
    const home = (await containerManager.exec(containerId, ['sh', '-c', 'echo $HOME'])).trim();
    if (home && home !== '/') {
      workspace = `${home}/workspace`;
    }
  } catch {
    // Fall back to /workspace
  }

  // Ensure workspace directory exists
  await containerManager.exec(containerId, ['mkdir', '-p', workspace]);

  // 0a. Ensure git is available
  try {
    await containerManager.exec(containerId, ['git', '--version']);
  } catch {
    console.log(`[WorkerAgent] git not found in ${shortId}, installing...`);
    await containerManager.exec(containerId, [
      'sh', '-c', 'apt-get update -qq && apt-get install -y -qq git > /dev/null 2>&1',
    ]);
  }

  // 1. Check if repo already cloned
  try {
    await containerManager.exec(containerId, ['test', '-d', `${workspace}/.git`]);
    console.log(`[WorkerAgent] Repo already cloned in ${shortId}, pulling latest`);
    await containerManager.exec(containerId, ['git', '-C', workspace, 'pull', '--ff-only']);
    return { cloned: true, method: 'git' };
  } catch {
    // Not cloned yet, proceed with clone strategies
  }

  // 2. Try gh repo clone first (uses gh auth if configured)
  let hasGh = false;
  try {
    await containerManager.exec(containerId, ['gh', '--version']);
    hasGh = true;
  } catch {
    // gh not available
  }

  if (hasGh) {
    try {
      console.log(`[WorkerAgent] Attempting clone via gh CLI in ${shortId}`);
      await containerManager.exec(containerId, [
        'gh', 'repo', 'clone', repoUrl, workspace, '--', '--depth=1',
      ]);
      console.log(`[WorkerAgent] Clone via gh succeeded in ${shortId}`);
      await postClone(containerManager, containerId, workspace, repoUrl, branch, claudeMd);
      return { cloned: true, method: 'gh' };
    } catch (err) {
      console.log(`[WorkerAgent] gh clone failed in ${shortId}: ${(err as Error).message}`);
    }
  }

  // 3. Try git clone with PAT (if provided)
  if (gitToken) {
    try {
      const authUrl = authenticatedUrl(repoUrl, gitToken);
      console.log(`[WorkerAgent] Attempting authenticated git clone in ${shortId}`);
      await containerManager.exec(containerId, ['git', 'clone', authUrl, workspace]);
      // Strip credentials from the remote URL
      try {
        await containerManager.exec(containerId, [
          'git', '-C', workspace, 'remote', 'set-url', 'origin', repoUrl,
        ]);
      } catch { /* best-effort */ }
      console.log(`[WorkerAgent] Authenticated clone succeeded in ${shortId}`);
      await postClone(containerManager, containerId, workspace, repoUrl, branch, claudeMd);
      return { cloned: true, method: 'pat' };
    } catch (err) {
      console.log(`[WorkerAgent] PAT clone failed in ${shortId}: ${(err as Error).message}`);
    }
  }

  // 4. Try plain git clone (public repos)
  try {
    console.log(`[WorkerAgent] Attempting unauthenticated git clone in ${shortId}`);
    await containerManager.exec(containerId, ['git', 'clone', repoUrl, workspace]);
    console.log(`[WorkerAgent] Unauthenticated clone succeeded in ${shortId}`);
    await postClone(containerManager, containerId, workspace, repoUrl, branch, claudeMd);
    return { cloned: true, method: 'git' };
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[WorkerAgent] All clone methods failed in ${shortId}: ${msg}`);
  }

  // All methods failed — still write CLAUDE.md if provided
  if (claudeMd) {
    try {
      await writClaudeMd(containerManager, containerId, workspace, claudeMd);
    } catch { /* best-effort */ }
  }

  const methods = [hasGh ? 'gh' : null, gitToken ? 'PAT' : null, 'git'].filter(Boolean).join(', ');
  return { cloned: false, error: `Repository clone failed (tried: ${methods}). Clone it manually inside the container.` };
}

/**
 * Post-clone steps: checkout branch and write CLAUDE.md.
 */
async function postClone(
  containerManager: ContainerManager,
  containerId: string,
  workspace: string,
  repoUrl: string,
  branch: string | undefined,
  claudeMd: string | undefined,
): Promise<void> {
  const shortId = containerId.substring(0, 12);

  // Checkout branch if specified
  if (branch) {
    console.log(`[WorkerAgent] Checking out branch "${branch}" in ${shortId}`);
    try {
      await containerManager.exec(containerId, [
        'git', '-C', workspace, 'checkout', branch,
      ]);
    } catch {
      console.log(`[WorkerAgent] Branch "${branch}" not found, creating new branch in ${shortId}`);
      await containerManager.exec(containerId, [
        'git', '-C', workspace, 'checkout', '-b', branch,
      ]);
    }
  }

  // Write CLAUDE.md if content is provided
  if (claudeMd) {
    await writClaudeMd(containerManager, containerId, workspace, claudeMd);
  }

  console.log(`[WorkerAgent] Repo setup complete for container ${shortId}`);
}

async function writClaudeMd(
  containerManager: ContainerManager,
  containerId: string,
  workspace: string,
  claudeMd: string,
): Promise<void> {
  const shortId = containerId.substring(0, 12);
  console.log(`[WorkerAgent] Writing CLAUDE.md in ${shortId}:${workspace}/CLAUDE.md`);
  await containerManager.exec(containerId, [
    'sh',
    '-c',
    `cat > ${workspace}/CLAUDE.md << 'CLAUDE_MD_EOF'\n${claudeMd}\nCLAUDE_MD_EOF`,
  ]);
}
