import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import InstitutionalFooterBar from '@/components/news/InstitutionalFooterBar';

/**
 * A moldura das telas de conta do candidato (mockups 04, 05 e 06): só a marca
 * e um atalho no topo, o miolo, e o fio de cinco cores no pé, com a mesma
 * entrada do rodapé da porta do app (`ana-enter-fio`). Sem o rodapé grande:
 * nessas telas a pessoa tem uma tarefa só.
 */
export function MolduraDaConta({ atalho, children }: { atalho: ReactNode; children: ReactNode }) {
  return (
    <div className="vg-fundo relative flex min-h-screen flex-col overflow-hidden text-foreground">
      <header className="relative z-10 flex h-16 items-center justify-between px-4 sm:px-8 lg:px-12">
        <Link to="/vagas" className="flex items-center gap-2.5 font-bold text-foreground">
          <img src="/logo.png" alt="" width={32} height={32} className="rounded-lg" />
          <span className="text-lg lowercase tracking-tight">anabrasil</span>
        </Link>
        <div className="text-sm font-semibold">{atalho}</div>
      </header>
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
      <InstitutionalFooterBar className="ana-fio ana-enter-fio" />
    </div>
  );
}
