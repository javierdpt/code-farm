import { NormalizedTicket } from '@code-farm/shared';
import { TicketProvider } from './provider.interface.js';

const GITHUB_ISSUE_RE = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/;

interface GitHubLabel {
  name: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  labels: GitHubLabel[];
}

interface GitHubComment {
  user: { login: string } | null;
  body: string;
  created_at: string;
}

export class GitHubIssuesProvider implements TicketProvider {
  name = 'github';

  matches(url: string): boolean {
    return GITHUB_ISSUE_RE.test(url);
  }

  async fetch(url: string): Promise<NormalizedTicket> {
    const match = url.match(GITHUB_ISSUE_RE);
    if (!match) {
      throw new Error(`Invalid GitHub issue URL: ${url}`);
    }

    const [, owner, repo, number] = match;
    const issueNumber = number;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'code-farm',
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const issueUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
    const commentsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`;

    const [issueResponse, commentsResponse] = await Promise.all([
      globalThis.fetch(issueUrl, { headers }),
      globalThis.fetch(commentsUrl, { headers }),
    ]);

    if (!issueResponse.ok) {
      if (issueResponse.status === 404) {
        throw new Error(`GitHub issue not found: ${owner}/${repo}#${issueNumber}`);
      }
      if (issueResponse.status === 403 || issueResponse.status === 429) {
        throw new Error(
          `GitHub API rate limit exceeded. Set GITHUB_TOKEN env var to increase limits.`
        );
      }
      throw new Error(
        `GitHub API error: ${issueResponse.status} ${issueResponse.statusText}`
      );
    }

    const issue: GitHubIssue = await issueResponse.json();

    let comments: GitHubComment[] = [];
    if (commentsResponse.ok) {
      comments = await commentsResponse.json();
    }

    const ticket: NormalizedTicket = {
      provider: 'github',
      url,
      id: String(issue.number),
      title: issue.title,
      description: issue.body ?? '',
      labels: issue.labels.map((l) => l.name),
      repoUrl: `https://github.com/${owner}/${repo}`,
      branch: undefined,
      comments: comments.map((c) => ({
        author: c.user?.login ?? 'unknown',
        body: c.body,
        createdAt: new Date(c.created_at),
      })),
    };

    return ticket;
  }
}
