import { parseContainerName } from '@/core/format';

const providerLabels: Record<string, string> = {
  github: 'GitHub',
  azdo: 'Azure',
  ticket: 'Ticket',
};

interface ContainerNameProps {
  name: string;
  className?: string;
}

export function ContainerName({ name, className = '' }: ContainerNameProps) {
  const parts = parseContainerName(name);

  if (!parts.provider) {
    return <span className={className}>{name}</span>;
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 ${className}`}>
      <span className="text-vsc-accent-blue">{parts.image}</span>
      <span className="text-vsc-text-secondary/40">/</span>
      <span className="text-vsc-text-secondary">{providerLabels[parts.provider] ?? parts.provider}</span>
      <span className="text-vsc-text-secondary/40">/</span>
      <span className="text-vsc-warning">{parts.owner}</span>
      <span className="text-vsc-text-secondary/40">/</span>
      <span className="text-vsc-text-primary">{parts.repo}</span>
      <span className="text-vsc-text-secondary/40">#</span>
      <span className="text-vsc-success">{parts.ticketId}</span>
    </span>
  );
}
