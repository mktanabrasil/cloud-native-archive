import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import InstitutionalFooterBar from '@/components/news/InstitutionalFooterBar';
import { UiV2 } from '@/lib/uiV2';
import { TemaFlutuante } from '@/components/ThemeToggle';
import { ROTA_DO_CALENDARIO } from '@/lib/calendario/conta';

/**
 * A moldura do Calendário Anual (14/11/2026): a mesma das contas de
 * candidato. Só a marca e um atalho no topo, sem o menu do app: a
 * coordenadora tem uma tarefa só aqui, e nenhum caminho para outra página.
 */
export function MolduraDoCalendario({ atalho, children }: { atalho?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('ui-v2');
    const titulo = document.title;
    document.title = 'Calendário Anual · ANA Brasil';
    return () => { document.body.classList.remove('ui-v2'); document.title = titulo; };
  }, []);
  return (
    <UiV2>
      <div className="vg-fundo relative flex min-h-screen flex-col overflow-x-clip text-foreground">
        <div className="ana-mesh" aria-hidden="true" />
        <header className="glass-1 sticky top-3 z-40 mx-3 mt-3 rounded-[18px] lg:mx-6">
          <div className="flex h-14 items-center justify-between gap-3 pl-3 pr-4">
            <Link to={ROTA_DO_CALENDARIO} className="flex items-center gap-2 text-foreground">
              <img src="/logo.png" alt="" width={32} height={32} />
              <span className="text-[17px] leading-none" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, letterSpacing: '-0.05em' }}>anabrasil</span>
              <span className="hidden text-[13px] text-muted-foreground sm:inline">· Calendário Anual</span>
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
