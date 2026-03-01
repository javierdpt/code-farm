import { TicketProvider } from './provider.interface.js';
import { NormalizedTicket } from '@code-farm/shared';

export class TrelloProvider implements TicketProvider {
  name = 'trello';

  matches(url: string): boolean {
    return /trello\.com/.test(url);
  }

  async fetch(url: string): Promise<NormalizedTicket> {
    throw new Error('Trello provider not yet implemented');
  }
}
