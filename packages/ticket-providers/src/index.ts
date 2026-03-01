import { TicketProvider } from './provider.interface.js';
import { GitHubIssuesProvider } from './github-issues.js';
import { AzureDevOpsProvider } from './azure-devops.js';
import { TrelloProvider } from './trello.js';
import { MondayProvider } from './monday.js';

export type { TicketProvider } from './provider.interface.js';
export { GitHubIssuesProvider } from './github-issues.js';

const providers: TicketProvider[] = [
  new GitHubIssuesProvider(),
  new AzureDevOpsProvider(),
  new TrelloProvider(),
  new MondayProvider(),
];

export function resolveProvider(url: string): TicketProvider | undefined {
  return providers.find(p => p.matches(url));
}

export function getSupportedProviders(): string[] {
  return providers.map(p => p.name);
}
