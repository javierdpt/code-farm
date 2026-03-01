import { ContainerManager } from './container-manager.js';

/**
 * Clone a repository inside a container and optionally write a CLAUDE.md file.
 *
 * All commands are executed inside the container via `podman exec`.
 *
 * @param containerManager - The container manager instance
 * @param containerId      - Target container ID
 * @param repoUrl          - Git repository URL to clone
 * @param branch           - Optional branch to checkout (created if it does not exist)
 * @param claudeMd         - Optional CLAUDE.md content to write into /workspace
 */
export async function setupRepo(
  containerManager: ContainerManager,
  containerId: string,
  repoUrl: string,
  branch: string | undefined,
  claudeMd: string | undefined,
): Promise<void> {
  const shortId = containerId.substring(0, 12);

  console.log(
    `[WorkerAgent] Setting up repo in container ${shortId}: ${repoUrl}`,
  );

  // 1. Clone the repository into /workspace
  try {
    // Check if /workspace already exists and has a git repo
    await containerManager.exec(containerId, [
      'test', '-d', '/workspace/.git',
    ]);

    // If we get here, repo already exists - pull latest
    console.log(`[WorkerAgent] Repo already cloned in ${shortId}, pulling latest`);
    await containerManager.exec(containerId, [
      'git', '-C', '/workspace', 'pull', '--ff-only',
    ]);
  } catch {
    // /workspace/.git does not exist, clone fresh
    console.log(`[WorkerAgent] Cloning ${repoUrl} into ${shortId}:/workspace`);
    await containerManager.exec(containerId, [
      'git', 'clone', repoUrl, '/workspace',
    ]);
  }

  // 2. Checkout the branch if specified
  if (branch) {
    console.log(`[WorkerAgent] Checking out branch "${branch}" in ${shortId}`);
    try {
      // Try to checkout an existing branch first
      await containerManager.exec(containerId, [
        'git', '-C', '/workspace', 'checkout', branch,
      ]);
    } catch {
      // Branch doesn't exist remotely; create a new local branch
      console.log(
        `[WorkerAgent] Branch "${branch}" not found, creating new branch in ${shortId}`,
      );
      await containerManager.exec(containerId, [
        'git', '-C', '/workspace', 'checkout', '-b', branch,
      ]);
    }
  }

  // 3. Write CLAUDE.md if content is provided
  if (claudeMd) {
    console.log(`[WorkerAgent] Writing CLAUDE.md in ${shortId}:/workspace/CLAUDE.md`);
    // Use sh -c with a heredoc-style approach via printf to handle
    // multi-line content safely
    await containerManager.exec(containerId, [
      'sh',
      '-c',
      `cat > /workspace/CLAUDE.md << 'CLAUDE_MD_EOF'\n${claudeMd}\nCLAUDE_MD_EOF`,
    ]);
  }

  console.log(`[WorkerAgent] Repo setup complete for container ${shortId}`);
}
