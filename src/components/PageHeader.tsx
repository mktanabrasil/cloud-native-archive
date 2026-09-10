import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  hidden?: boolean;
  className?: string;
  /**
   * Nível do título. Padrão h1. A página pública de eventos usa h2: o herói
   * dela já vem antes com um h2 por slide, e o h1 (visível só para leitor de
   * tela) fica no topo da página, para a ordem dos títulos fazer sentido.
   */
  nivel?: 1 | 2;
}

/**
 * Padronized header for all pages.
 * Layout: title + description on the left, actions/tools on the right.
 * On mobile stacks vertically.
 */
export default function PageHeader({ title, description, actions, hidden, className, nivel = 1 }: PageHeaderProps) {
  const Titulo = nivel === 2 ? 'h2' : 'h1';
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6", className)}>
      {!hidden ? (
        <div className="min-w-0">
          <Titulo className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">{title}</Titulo>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      ) : (
        <div />
      )}
      {actions && (
        <div className={cn("flex flex-wrap items-center gap-2 sm:gap-3", hidden && "ml-auto")}>
          {actions}
        </div>
      )}
    </header>
  );
}
