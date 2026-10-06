import { NavLink } from 'react-router-dom';
import { Briefcase, FileUp, Search, User } from 'lucide-react';
import { ROTAS_DO_CANDIDATO } from '@/lib/vagas/conta';

/**
 * A barra de abas do candidato no celular (mockup do PR 8, 06/10/2026):
 * Vagas, Candidaturas, Currículo e Perfil. Fica presa embaixo só em telas
 * pequenas; no computador some, porque o topo já leva a tudo.
 */
const ABAS = [
  { para: '/vagas', rotulo: 'Vagas', Icone: Search, fim: true },
  { para: ROTAS_DO_CANDIDATO.minhaArea, rotulo: 'Candidaturas', Icone: Briefcase, fim: false },
  { para: ROTAS_DO_CANDIDATO.curriculo, rotulo: 'Currículo', Icone: FileUp, fim: true },
  { para: ROTAS_DO_CANDIDATO.meuPerfil, rotulo: 'Perfil', Icone: User, fim: true },
] as const;

export function AbasDoCandidato() {
  return (
    <>
      <div className="h-20 sm:hidden" aria-hidden />
      <nav aria-label="Áreas do candidato" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 bg-muted/95 px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:hidden">
        {ABAS.map(({ para, rotulo, Icone, fim }) => (
          <NavLink key={rotulo} to={para} end={fim}
            className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            {({ isActive }) => (
              <>
                <span className={`grid h-7 w-10 place-items-center rounded-lg ${isActive ? 'bg-[#81E2CF] text-[#1F2322]' : ''}`}><Icone className="h-[18px] w-[18px]" aria-hidden /></span>
                {rotulo}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
