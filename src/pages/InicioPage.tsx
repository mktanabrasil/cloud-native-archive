import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useApoiadores } from '@/hooks/useApoiadores';
import { useVoluntariado } from '@/hooks/useVoluntariado';
import { useSouResponsavel } from '@/hooks/useSouResponsavel';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { cn } from '@/lib/utils';
import { COR_DO_SETOR, ROTAS, navItems, setoresVisiveis } from '@/config/navigation';
import { ehUnidadeDoJornal, findNewsUnit, newsUnitName } from '@/lib/news/units';
import {
  buscarEventos, buscarJornais, buscarPaginas, dataPorExtenso, linkDoEvento, linkDoJornal, marcarTermo,
  proximosEventos, saudacao, type EventoDaBusca, type JornalDaBusca,
} from '@/lib/inicio/busca';

/** Ícone do setor no quadradinho da cor dele (como na barra e na faixa). */
function IconeDoSetor({ setor }: { setor: string }) {
  const item = navItems.find(i => i.to === setor);
  const Icone = item?.icon;
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[#1F2322]" style={{ background: `color-mix(in srgb, ${COR_DO_SETOR[setor] ?? '#8A938F'} 30%, white)` }} aria-hidden>
      {Icone && <Icone className="h-4 w-4" strokeWidth={2} />}
    </span>
  );
}

/** A data do evento num bloquinho: "22 / NOV". */
function DataDoEvento({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="grid w-11 shrink-0 place-items-center rounded-[12px] py-1 leading-none" style={{ background: `color-mix(in srgb, ${COR_DO_SETOR[ROTAS.eventos]} 18%, white)` }} aria-hidden>
      <b className="font-display text-[18px] text-[#1F2322]">{String(d.getDate()).padStart(2, '0')}</b>
      <span className="mt-0.5 text-[10.5px] uppercase text-[#5b6461]">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
    </span>
  );
}

/** O termo buscado, marcado no título. */
function Marcado({ texto, termo }: { texto: string; termo: string }) {
  const [antes, achado, depois] = marcarTermo(texto, termo);
  return <>{antes}{achado && <mark className="rounded bg-[#fbce00]/40 px-0.5 text-inherit">{achado}</mark>}{depois}</>;
}

interface Resultado {
  chave: string;
  grupo: 'Páginas' | 'Eventos' | 'Jornais';
  titulo: string;
  detalhe: string;
  para: string;
  icone: ReactNode;
}

const visibilidade = (v: string) => (v === 'interno' ? 'interno' : 'público');
const situacaoDoEvento = (s: string) => (s === 'pendente' ? ' · pendente' : s === 'cancelado' ? ' · cancelado' : '');

/**
 * A página inicial (17/11/2026): a saudação, a busca e os próximos eventos.
 * É o que `app.anabrasil.org` mostra a quem está logado (ver `RaizPage`) e
 * aonde o logo leva. A gestão da Educação, que não vê o Social, vê os
 * últimos jornais finalizados no lugar dos eventos.
 */
export default function InicioPage() {
  useTituloDaAba('Início · ANA Brasil');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const papel = useUserRole();
  const souResponsavel = useSouResponsavel();
  const { vejo: temApoiadores } = useApoiadores();
  const { vejo: temVoluntariado } = useVoluntariado();
  const { loading: carregandoEventos } = useApp();
  const daEquipe = useFilteredEvents(false, false);
  const daVitrine = useFilteredEvents(true, false);
  const [agora] = useState(() => new Date());
  const [termo, setTermo] = useState('');
  const [escolhido, setEscolhido] = useState(0);
  const [jornais, setJornais] = useState<JornalDaBusca[]>([]);
  const campo = useRef<HTMLInputElement>(null);
  const idDaLista = useId();

  const { isMarketing, canAccessJournal, soEducacao, temSemanario, isRh, temFinanceiro, temCalendarioAnual, isAdmin, isManager, canViewAuditoria, userName } = papel;
  const setores = setoresVisiveis({ isAuthenticated, soEducacao, canAccessJournal, temSemanario, isRh, souResponsavel, temVoluntariado, temFinanceiro, temApoiadores, isMarketing, isAdmin, isManager, canViewAuditoria });
  const quem = { soEducacao: !!soEducacao, canAccessJournal: !!canAccessJournal, temSemanario: !!temSemanario, temCalendario: !!(isMarketing || temCalendarioAnual), veVagas: !!(isRh || souResponsavel), temVoluntariado: !!temVoluntariado, temFinanceiro: !!temFinanceiro, temApoiadores, isMarketing: !!isMarketing };

  // Os eventos que a pessoa já vê na programação: os da equipe e os da vitrine, sem repetir.
  const eventos = useMemo(() => {
    const ids = new Set(daEquipe.map(e => e.id));
    return [...daEquipe, ...daVitrine.filter(e => !ids.has(e.id))] as EventoDaBusca[];
  }, [daEquipe, daVitrine]);

  // Os jornais que ela pode abrir (a RLS recorta): sem as páginas, que pesam.
  useEffect(() => {
    if (!canAccessJournal) return;
    let vivo = true;
    void (async () => {
      const { data } = await supabase
        .from('journals')
        .select('id, name, unit_id, status, reference_month, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      if (vivo && data) setJornais(data as unknown as JornalDaBusca[]);
    })();
    return () => { vivo = false; };
  }, [canAccessJournal]);

  // "/" leva à busca, de qualquer lugar da página (menos de dentro de um campo).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return;
      e.preventDefault();
      campo.current?.focus();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const resultados: Resultado[] = useMemo(() => {
    if (termo.trim().length < 2) return [];
    const paginas = buscarPaginas(termo, quem).map((p): Resultado => ({
      chave: `p:${p.titulo}`, grupo: 'Páginas', titulo: p.titulo, detalhe: p.detalhe, para: p.para, icone: <IconeDoSetor setor={p.setor} />,
    }));
    const evs = soEducacao ? [] : buscarEventos(termo, eventos, agora).map((e): Resultado => ({
      chave: `e:${e.id}`, grupo: 'Eventos', titulo: e.title, detalhe: `${e.unit} · ${visibilidade(e.visibility)}${situacaoDoEvento(e.status)}`, para: linkDoEvento(e), icone: <DataDoEvento iso={e.start_datetime} />,
    }));
    const jns = canAccessJournal ? buscarJornais(termo, jornais, (id) => newsUnitName(id) || 'Institucional geral').map((j): Resultado => ({
      chave: `j:${j.id}`, grupo: 'Jornais', titulo: j.name, detalhe: [newsUnitName(j.unit_id) || 'Institucional geral', j.status === 'rascunho' ? 'rascunho' : 'finalizado'].join(' · '), para: linkDoJornal(j), icone: <IconeDoSetor setor={ROTAS.jornal} />,
    })) : [];
    return [...paginas, ...evs, ...jns];
    // `quem` é recalculado a cada quadro; as partes dele estão aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, eventos, jornais, agora, soEducacao, canAccessJournal, temSemanario, isMarketing, temCalendarioAnual, isRh, souResponsavel, temVoluntariado, temFinanceiro, temApoiadores]);

  useEffect(() => { setEscolhido(0); }, [termo]);

  const abrir = (r: Resultado | undefined) => { if (r) navigate(r.para); };
  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setEscolhido(i => Math.min(i + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setEscolhido(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); abrir(resultados[escolhido]); }
    else if (e.key === 'Escape') { setTermo(''); }
  };

  const nome = userName?.trim().split(/\s+/)[0];
  const buscando = termo.trim().length >= 2;
  const proximos = proximosEventos(eventos, agora);
  const finalizados = jornais.filter(j => j.status === 'finalizado' && ehUnidadeDoJornal(j.unit_id)).slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pb-16 pt-8 sm:pt-14">
      <img src={logoImg} alt="" className="h-12 w-12 sm:h-14 sm:w-14" />
      <p className="mt-5 text-[13px] font-medium text-muted-foreground">{dataPorExtenso(agora)}</p>
      <h1 className="mt-1 text-balance text-center font-display text-[30px] font-bold leading-[1.1] tracking-tight sm:text-[44px]">
        {saudacao(agora)}{nome ? `, ${nome}` : ''}
      </h1>

      <div className="relative mt-7 w-full">
        <div className={cn('glass-2 flex w-full items-center gap-3 rounded-full px-4 py-3 sm:px-5 sm:py-4', buscando && 'ring-2 ring-[#81e2cf]')}>
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={campo}
            type="search"
            value={termo}
            onChange={e => setTermo(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder={soEducacao ? 'Procurar jornal ou página…' : canAccessJournal ? 'Procurar evento, jornal ou página…' : 'Procurar evento ou página…'}
            aria-label="Procurar no app"
            role="combobox"
            aria-expanded={buscando}
            aria-controls={idDaLista}
            aria-activedescendant={buscando && resultados[escolhido] ? `${idDaLista}-${escolhido}` : undefined}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          {!buscando && <kbd className="hidden rounded-md border border-black/15 px-1.5 text-[11px] text-muted-foreground dark:border-white/15 sm:inline">/</kbd>}
        </div>

        {buscando && (
          <div className="glass-1 absolute inset-x-0 top-[calc(100%+8px)] z-20 max-h-[60vh] overflow-y-auto rounded-[22px] p-2">
            {resultados.length === 0 ? (
              <p className="px-4 py-5 text-center text-[14px] text-muted-foreground">Nada encontrado para “{termo.trim()}”.</p>
            ) : (
              <ul id={idDaLista} role="listbox" aria-label="Resultados">
                {resultados.map((r, i) => (
                  <li key={r.chave} role="presentation">
                    {(i === 0 || resultados[i - 1].grupo !== r.grupo) && (
                      <p className="px-4 pb-1 pt-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground" aria-hidden>{r.grupo}</p>
                    )}
                    <button
                      type="button"
                      id={`${idDaLista}-${i}`}
                      role="option"
                      aria-selected={i === escolhido}
                      onMouseEnter={() => setEscolhido(i)}
                      onClick={() => abrir(r)}
                      className={cn('flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors', i === escolhido && 'bg-[hsl(var(--ativo))]')}
                    >
                      {r.icone}
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[14px] font-semibold text-foreground"><Marcado texto={r.titulo} termo={termo} /></b>
                        <span className="block truncate text-[12px] text-muted-foreground">{r.detalhe}</span>
                      </span>
                      {i === escolhido && <span className="hidden text-[11.5px] text-muted-foreground sm:inline">Enter</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Os setores: no celular a doca já os mostra. */}
      {setores.length > 1 && (
        <nav aria-label="Setores" className="mt-5 hidden flex-wrap justify-center gap-2 sm:flex">
          {setores.map(s => (
            <Link key={s.to} to={s.to} className="flex items-center gap-2 rounded-full border border-black/10 bg-white/55 py-1 pl-1 pr-3 text-[13px] text-foreground transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
              <IconeDoSetor setor={s.to} />{s.label}
            </Link>
          ))}
        </nav>
      )}

      <section className="mt-10 w-full" aria-labelledby="lista-da-inicial">
        {soEducacao ? (
          <>
            <h2 id="lista-da-inicial" className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Jornais finalizados</h2>
            {finalizados.length === 0 ? (
              <p className="mt-3 text-center text-[13.5px] text-muted-foreground">Nenhum jornal finalizado ainda.</p>
            ) : (
              <ul className="mt-3 divide-y divide-black/[.07] dark:divide-white/10">
                {finalizados.map(j => (
                  <li key={j.id}>
                    <Link to={`${ROTAS.jornaisDasUnidades}?ler=${encodeURIComponent(j.id)}`} className="flex items-center gap-3 py-3">
                      <IconeDoSetor setor={ROTAS.jornal} />
                      <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px] font-semibold">{j.name}</b><span className="text-[12px] text-muted-foreground">{findNewsUnit(j.unit_id)?.short ?? newsUnitName(j.unit_id)}{j.reference_month && !j.name.includes(j.reference_month) ? ` · ${j.reference_month}` : ''}</span></span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-center"><Link to={ROTAS.jornaisDasUnidades} className="text-[13px] font-medium text-[hsl(var(--sel,168_80%_27%))] hover:underline">Ver todos os jornais</Link></p>
          </>
        ) : (
          <>
            <h2 id="lista-da-inicial" className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Próximos eventos</h2>
            {carregandoEventos ? (
              <div className="mt-3 space-y-2" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-[14px] bg-black/[.04] dark:bg-white/[.05]" />)}</div>
            ) : proximos.length === 0 ? (
              <p className="mt-3 text-center text-[13.5px] text-muted-foreground">Nenhum evento marcado por enquanto.</p>
            ) : (
              <ul className="mt-3 divide-y divide-black/[.07] dark:divide-white/10">
                {proximos.map(e => (
                  <li key={e.id}>
                    <Link to={linkDoEvento(e)} className="flex items-center gap-3 py-3">
                      <DataDoEvento iso={e.start_datetime} />
                      <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px] font-semibold">{e.title}</b><span className="text-[12px] text-muted-foreground">{e.unit} · {visibilidade(e.visibility)}{situacaoDoEvento(e.status)}</span></span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-center"><Link to={ROTAS.eventos} className="text-[13px] font-medium text-[hsl(var(--sel,168_80%_27%))] hover:underline">Ver todos os eventos</Link></p>
          </>
        )}
      </section>
    </div>
  );
}
