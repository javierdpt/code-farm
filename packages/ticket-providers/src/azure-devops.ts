import { TicketProvider } from './provider.interface.js';
import { NormalizedTicket } from '@code-farm/shared';

export class AzureDevOpsProvider implements TicketProvider {
  name = 'azure-devops';

  matches(url: string): boolean {
    return /dev\.azure\.com/.test(url) || /\.visualstudio\.com/.test(url);
  }

  async fetch(url: string): Promise<NormalizedTicket> {
    throw new Error('Azure DevOps provider not yet implemented');
  }
}
