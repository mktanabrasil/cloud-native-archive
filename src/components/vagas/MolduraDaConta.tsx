import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import InstitutionalFooterBar from '@/components/news/InstitutionalFooterBar';
import { UiV2 } from '@/lib/uiV2';
import { TemaFlutuante } from '@/components/ThemeToggle';

/**
 * A moldura das telas de conta do candidato (mockups 04, 05 e 06): só a marca
 * e um atalho no topo, o miolo, e o fio de cinco cores no pé, com a mesma
 * entrada do rodapé da porta do app (`ana-enter-fio`). Sem o rodapé grande:
 * nessas telas a pessoa tem uma tarefa só.
 *
 * Esboço V2 (26/10/2026): o mesmo tratamento da MolduraDasVagas: liga o
 * `ui-v2` no body, a malha de cores no fundo e o topo numa barra de vidro.
 * O corte lateral é `overflow-x-clip` (não `hidden`), para a barra poder
 * ficar presa no alto ao rolar.
 */
export function MolduraDaConta({ atalho, children }: { atalho: ReactNode; children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('ui-v2');
    return () => document.body.classList.remove('ui-v2');
  }, []);
  return (
    <UiV2>
    <div className="vg-fundo relative flex min-h-screen flex-col overflow-x-clip text-foreground">
      <div className="ana-mesh" aria-hidden="true" />
      <header className="glass-1 sticky top-3 z-40 mx-3 mt-3 rounded-[18px] lg:mx-6">
        <div className="flex h-14 items-center justify-between gap-3 pl-3 pr-4">
          <Link to="/vagas" className="flex items-center gap-2 text-foreground">
            <img src="/logo.png" alt="" width={32} height={32} />
            <span className="text-[17px] leading-none" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, letterSpacing: '-0.05em' }}>anabrasil</span>
          </Link>
          <div className="text-sm font-semibold">{atalho}</div>
        </div>
      </header>
      <main className="relative z-10 flex flex-1 flex-col pt-4">{children}</main>
      <InstitutionalFooterBar className="ana-fio ana-enter-fio" />
      <TemaFlutuante />
    </div>
    </UiV2>
  );
}
