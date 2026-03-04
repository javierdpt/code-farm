import { TicketProvider, ProviderFetchOptions } from './provider.interface.js';
import { NormalizedTicket } from '@javierdpt/code-farm-shared';

const AZURE_DEVOPS_RE =
  /dev\.azure\.com\/([^/]+)\/([^/]+)\/_workitems\/edit\/(\d+)/;

export class AzureDevOpsProvider implements TicketProvider {
  name = 'azure-devops';

  matches(url: string): boolean {
    return /dev\.azure\.com/.test(url) || /\.visualstudio\.com/.test(url);
  }

  async fetch(url: string, options?: ProviderFetchOptions): Promise<NormalizedTicket> {
    const match = url.match(AZURE_DEVOPS_RE);
    if (!match) {
      throw new Error(
        `Invalid Azure DevOps work item URL. Expected format: dev.azure.com/{org}/{project}/_workitems/edit/{id}`,
      );
    }

    const [, org, project, workItemId] = match;

    const token = options?.token || process.env.AZURE_DEVOPS_PAT;
    if (!token) {
      throw new Error('Unauthorized — configure your Azure DevOps token');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`:${token}`)}`,
    };

    const apiUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/workitems/${workItemId}?api-version=7.1`;

    const response = await globalThis.fetch(apiUrl, { headers });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Unauthorized — configure your Azure DevOps token');
      }
      if (response.status === 404) {
        throw new Error(
          `Azure DevOps work item not found: ${org}/${project}#${workItemId}`,
        );
      }
      throw new Error(
        `Azure DevOps API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const fields = data.fields ?? {};

    const tags: string[] = fields['System.Tags']
      ? fields['System.Tags'].split(';').map((t: string) => t.trim()).filter(Boolean)
      : [];

    const ticket: NormalizedTicket = {
      provider: 'azure-devops',
      url,
      id: String(workItemId),
      title: fields['System.Title'] ?? '',
      description: fields['System.Description'] ?? '',
      labels: tags,
      repoUrl: undefined,
      branch: undefined,
      comments: [],
    };

    return ticket;
  }
}
