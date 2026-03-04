import { TicketProvider } from './provider.interface.js';
import { NormalizedTicket } from '@javierdpt/code-farm-shared';

export class MondayProvider implements TicketProvider {
  name = 'monday';

  matches(url: string): boolean {
    return /monday\.com/.test(url);
  }

  async fetch(url: string): Promise<NormalizedTicket> {
    throw new Error('Monday provider not yet implemented');
  }
}
