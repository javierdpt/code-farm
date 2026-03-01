import { NormalizedTicket } from '@code-farm/shared';

export interface TicketProvider {
  name: string;
  /** Test if a URL belongs to this provider */
  matches(url: string): boolean;
  /** Fetch and normalize ticket data from the URL */
  fetch(url: string): Promise<NormalizedTicket>;
}
