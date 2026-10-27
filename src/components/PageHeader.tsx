import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useUiV2 } from '@/lib/uiV2';

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
  // V2: título de 28 px que quebra em vez de cortar. Fora do app (embeds), como era.
  const v2 = useUiV2();
  return (
    <header className={cn("flex flex-col gap-4 mb-6", v2 ? "lg:flex-row lg:items-center lg:justify-between" : "md:flex-row md:items-center md:justify-between", className)}>
      {!hidden ? (
        <div className={v2 ? "min-w-0 shrink-0 md:max-w-[45%]" : "min-w-0"}>
          <Titulo className={v2 ? "text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-[28px] [text-wrap:balance]" : "text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate"}>{title}</Titulo>
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
