import { NormalizedTicket } from '@code-farm/shared';

export function defaultTemplate(ticket: NormalizedTicket): string {
  const sections: string[] = [];

  sections.push(`# Task: ${ticket.title}`);
  sections.push(`## Source\n\n${ticket.url}`);

  if (ticket.description) {
    sections.push(`## Description\n\n${ticket.description}`);
  }

  if (ticket.labels.length > 0) {
    sections.push(`## Labels\n\n${ticket.labels.join(', ')}`);
  }

  if (ticket.branch) {
    sections.push(`## Branch\n\n\`${ticket.branch}\``);
  }

  if (ticket.comments.length > 0) {
    const commentLines = ticket.comments.map((c) => {
      const date = c.createdAt instanceof Date
        ? c.createdAt.toISOString().split('T')[0]
        : String(c.createdAt);
      return `### ${c.author} (${date})\n\n${c.body}`;
    });
    sections.push(`## Discussion\n\n${commentLines.join('\n\n')}`);
  }

  sections.push(`## Instructions

- Read the codebase and understand the existing architecture before making changes.
- Follow existing code conventions and patterns found in the repository.
- Write tests for any new functionality.
- Make small, focused commits with clear messages.
- Ensure all existing tests continue to pass.
- Update documentation if the public API changes.`);

  return sections.join('\n\n');
}
