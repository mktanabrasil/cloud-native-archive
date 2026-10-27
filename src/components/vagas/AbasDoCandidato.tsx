import { NavLink } from 'react-router-dom';
import { ROTAS_DO_CANDIDATO } from '@/lib/vagas/conta';

/**
 * A barra de abas do candidato no celular (mockup do PR 8, 06/10/2026):
 * Vagas, Candidaturas, Currículo e Perfil. Fica presa embaixo só em telas
 * pequenas; no computador some, porque o topo já leva a tudo.
 *
 * Esboço V2 (26/10/2026): vira a doca de vidro do app, flutuando acima da
 * borda, com a bolinha sobre o rótulo no lugar do ícone.
 */
const ABAS = [
  { para: '/vagas', rotulo: 'Vagas', fim: true },
  { para: ROTAS_DO_CANDIDATO.minhaArea, rotulo: 'Candidaturas', fim: false },
  { para: ROTAS_DO_CANDIDATO.curriculo, rotulo: 'Currículo', fim: true },
  { para: ROTAS_DO_CANDIDATO.meuPerfil, rotulo: 'Perfil', fim: true },
] as const;

export function AbasDoCandidato() {
  return (
    <>
      <div className="h-24 sm:hidden" aria-hidden />
      <nav aria-label="Áreas do candidato"
        className="glass-1 fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto grid max-w-md grid-cols-4 rounded-[24px] px-1 py-2 sm:hidden">
        {ABAS.map(({ para, rotulo, fim }) => (
          <NavLink key={rotulo} to={para} end={fim}
            className={({ isActive }) => `grid min-h-11 content-center justify-items-center gap-1 text-[11px] font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
            {({ isActive }) => (
              <>
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-current' : 'bg-transparent'}`} aria-hidden />
                <span className="max-w-full truncate px-0.5">{rotulo}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
