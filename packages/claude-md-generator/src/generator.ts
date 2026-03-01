import { NormalizedTicket } from '@code-farm/shared';
import { defaultTemplate } from './templates/default.js';

export interface GeneratorOptions {
  template?: (ticket: NormalizedTicket) => string;
  extraInstructions?: string;
}

export function generateClaudeMd(ticket: NormalizedTicket, options?: GeneratorOptions): string {
  const template = options?.template ?? defaultTemplate;
  let content = template(ticket);
  if (options?.extraInstructions) {
    content += '\n\n## Additional Instructions\n\n' + options.extraInstructions;
  }
  return content;
}
