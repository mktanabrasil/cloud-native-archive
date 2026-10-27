import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Accessibility, GraduationCap, LayoutGrid, List, Search, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { escolheuVerSemEntrar, lembrarVerSemEntrar } from '@/lib/vagas/conta';
import EntrarCandidatoPage from './EntrarCandidatoPage';
import { PainelDoRh } from '@/components/vagas/PainelDoRh';
import { ProcessosDoRh } from '@/components/vagas/ProcessosDoRh';
import { MeusProcessos } from '@/components/vagas/MeusProcessos';
import { useSouResponsavel } from '@/hooks/useSouResponsavel';
import { GestaoDeVagas } from '@/components/vagas/GestaoDeVagas';
import { RelatoriosDoRh } from '@/components/vagas/RelatoriosDoRh';
import { AuditoriaDasVagas } from '@/components/vagas/AuditoriaDasVagas';
import { ModelosDeEmail } from '@/components/vagas/ModelosDeEmail';
import { CartaoDaVaga, COR_DA_AREA, ICONE_DA_AREA, MolduraDasVagas, PontoDaArea, comumDasVagas } from '@/components/vagas/PecasDasVagas';
import { guardarVista, separarProgramas, vistaGuardada, type Vista } from '@/lib/vagas/vitrine';
import { listarVagasPublicadas } from '@/lib/vagas/api';
import { ROTULO_DA_AREA, ROTULO_DA_CONTRATACAO, type Area, type Vaga } from '@/lib/vagas/modelo';
import { contagemPorArea, enderecoDoFiltro, filtrarVagas, filtroDoEndereco, vagasNoPlural, type FiltroDaVitrine } from '@/lib/vagas/vitrine';

/**
 * /vagas — o portal público de vagas (fase 1, tela 01 do mockup aprovado).
 *
 * Sem login: lê só as vagas publicadas (a política do banco garante). O
 * filtro vai para o endereço (?area=educacao&so=pcd&q=professor), para dar
 * para mandar a busca pronta e para o site do GOE abrir já em Educação.
 * "Candidatar-se" fica na página da vaga e, nesta fase, abre o Forms dela.
 */
export default function VagasPage() {
  const { isRh, isAdmin } = useUserRole();
  const souResponsavel = useSouResponsavel();
  const { isAuthenticated, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [semEntrar, setSemEntrar] = useState(escolheuVerSemEntrar);
  // Para o RH, /vagas puro abre o Painel (decisão de 19/10/2026); o portal fica em ?tela=portal.
  // Quem é responsável por um processo, sem ser RH, abre em "Meus processos" (passo 3, 19/10/2026).
  const pedida = params.get('tela');
  const portalPedido = pedida === 'portal' || (params.toString() !== '' && !pedida);
  type Tela = 'painel' | 'processos' | 'gestao' | 'relatorios' | 'emails' | 'auditoria' | 'portal' | 'meus';
  // Relatórios: só o RH; Auditoria: só administradores (passo 6, 20/10/2026).
  const tela: Tela = isRh
    ? (pedida === 'gestao' ? 'gestao' : pedida === 'processos' ? 'processos' : pedida === 'relatorios' ? 'relatorios' : pedida === 'emails' ? 'emails' : pedida === 'auditoria' && isAdmin ? 'auditoria' : portalPedido ? 'portal' : 'painel')
    : souResponsavel ? (portalPedido ? 'portal' : 'meus') : 'portal';
  const gestao = tela === 'gestao';
  useTituloDaAba(tela === 'emails' ? 'Modelos de e-mail · ANA Brasil' : tela === 'relatorios' ? 'Relatórios · ANA Brasil' : tela === 'auditoria' ? 'Auditoria das vagas · ANA Brasil' : tela === 'gestao' ? 'Gestão de vagas · ANA Brasil' : tela === 'painel' ? 'Painel do RH · ANA Brasil' : tela === 'processos' ? 'Processos · ANA Brasil' : tela === 'meus' ? 'Meus processos · ANA Brasil' : 'Trabalhe Conosco · ANA Brasil');
  // RH e admin veem quatro abas; o responsável, as dele; o público só a vitrine.
  const opcoes: ReadonlyArray<readonly [string, Tela]> = isRh
    ? [['Painel', 'painel'], ['Processos', 'processos'], ['Gestão', 'gestao'], ['Relatórios', 'relatorios'], ['Modelos de e-mail', 'emails'], ...(isAdmin ? [['Auditoria', 'auditoria'] as const] : []), ['Portal', 'portal']]
    : souResponsavel ? [['Meus processos', 'meus'], ['Portal', 'portal']] : [];
  const telaPadrao: Tela = isRh ? 'painel' : 'meus';
  const abas = opcoes.length ? (
    <nav aria-label="Vagas: abas" className="mt-4">
      <div className="mx-auto flex max-w-6xl gap-5 overflow-x-auto border-b border-border px-4 sm:px-6">
        {opcoes.map(([rotulo, t]) => (
          <button
            key={rotulo}
            type="button"
            aria-current={tela === t ? 'page' : undefined}
            onClick={() => setParams(t === telaPadrao ? new URLSearchParams() : new URLSearchParams(`tela=${t}`), { replace: true })}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 py-2.5 text-sm ${tela === t ? 'border-[#81e2cf] font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground'}`}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </nav>
  ) : null;
  // A porta (28/09/2026): /vagas puro, sem conta e sem ter escolhido olhar,
  // abre o login. Link com busca ou filtro (?area=educacao) e link de vaga
  // abrem direto: quem mandou o link quer que a pessoa veja aquilo.
  const porta = !loading && !isAuthenticated && !semEntrar && params.toString() === '';
  // Quem chegou por link com filtro já está vendo as vagas: limpar o filtro
  // depois (tocar em "Todas") não pode jogá-lo de volta na porta.
  useEffect(() => {
    if (!loading && !isAuthenticated && !semEntrar && !porta) { lembrarVerSemEntrar(); setSemEntrar(true); }
  }, [loading, isAuthenticated, semEntrar, porta]);
  if (loading) return null;
  if (porta) {
    return <EntrarCandidatoPage comoPorta aoVerVagas={() => { lembrarVerSemEntrar(); setSemEntrar(true); }} />;
  }
  return <MolduraDasVagas abas={abas}>{gestao ? <GestaoDeVagas /> : tela === 'relatorios' ? <RelatoriosDoRh /> : tela === 'emails' ? <ModelosDeEmail /> : tela === 'auditoria' ? <AuditoriaDasVagas /> : tela === 'painel' ? <PainelDoRh /> : tela === 'processos' ? <ProcessosDoRh /> : tela === 'meus' ? <MeusProcessos /> : <Vitrine />}</MolduraDasVagas>;
}

function Vitrine() {
  const [params, setParams] = useSearchParams();
  const filtro = useMemo(() => filtroDoEndereco(params), [params]);
  const [vagas, setVagas] = useState<Vaga[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [busca, setBusca] = useState(filtro.busca);
  // Grade ou lista (28/09/2026): a escolha fica guardada no aparelho.
  const [vista, setVista] = useState<Vista>(vistaGuardada);
  const trocarVista = (v: Vista) => { setVista(v); guardarVista(v); };

  useEffect(() => {
    let vivo = true;
    setErro(false);
    listarVagasPublicadas()
      .then(v => { if (vivo) setVagas(v); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [tentativa]);

  // Quem é RH está em ?tela=portal: filtrar não pode jogá-lo de volta no Painel.
  const manterTela = (p: URLSearchParams) => { if (params.get('tela') === 'portal') p.set('tela', 'portal'); return p; };
  const mudar = (f: Partial<FiltroDaVitrine>) => setParams(manterTela(enderecoDoFiltro({ ...filtro, ...f })), { replace: true });
  const lista = useMemo(() => (vagas ? filtrarVagas(vagas, filtro) : []), [vagas, filtro]);
  // Jovem Aprendiz e PcD vão no fim, separados (28/09/2026).
  const { comuns, programas } = useMemo(() => separarProgramas(lista), [lista]);
  const areas = useMemo(() => (vagas ? contagemPorArea(vagas) : []), [vagas]);
  const temFiltro = filtro.area !== null || filtro.especial !== null || filtro.busca !== '';
  const total = vagas?.length ?? 0;
  // O que toda vaga tem igual sai do cartão e aparece uma vez, acima da lista (esboço V2, 26/10/2026).
  // Os programas (Jovem Aprendiz, PcD) têm contratação própria e ficam de fora da conta.
  const comum = useMemo(() => comumDasVagas(separarProgramas(vagas ?? []).comuns), [vagas]);

  // Esboço V2: filtros como abas segmentadas, só texto; nas áreas, a bolinha da cor.
  const chip = (ativo: boolean, rotulo: string, ponto: Area | null, aoClicar: () => void) => (
    <button
      key={rotulo}
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-[13.5px] transition ${ativo ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`}
    >
      {ponto && <PontoDaArea area={ponto} />}{rotulo}
    </button>
  );
  const grade = vista === 'lista' ? 'grid grid-cols-[minmax(0,1fr)] gap-2 sm:gap-2.5' : 'grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:gap-4 md:grid-cols-2 lg:grid-cols-3';

  return (
    <>
      <section className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-8 px-4 pb-8 pt-9 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:pt-11">
        <div className="flex flex-col gap-4">
          <h1 className="text-[34px] font-bold leading-[1.05] tracking-tight sm:text-[46px]">Trabalhe com a gente.</h1>
          <p className="max-w-[480px] text-base text-muted-foreground sm:text-lg">
            {vagas === null || total === 0 ? 'Vagas nas unidades da ANA, em Campinas.' : `${vagasNoPlural(total)} ${total === 1 ? 'aberta' : 'abertas'}. Veja os detalhes e candidate-se em minutos.`}
          </p>
          <form
            role="search"
           
            className="glass-1 fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex gap-2 rounded-[22px] p-2 md:static md:max-w-[560px] md:gap-2.5 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
            onSubmit={e => { e.preventDefault(); mudar({ busca }); }}
          >
            <label htmlFor="busca-vaga" className="sr-only">Buscar vaga</label>
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-input bg-card px-3.5 focus-within:ring-2 focus-within:ring-ring md:h-12 md:rounded-xl md:px-4">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                id="busca-vaga"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Que vaga você procura?"
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              {busca && (
                <button type="button" aria-label="Limpar busca" onClick={() => { setBusca(''); mudar({ busca: '' }); }} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button type="submit" className="h-11 shrink-0 rounded-[14px] px-4 text-base md:h-12 md:rounded-xl md:px-6">Buscar</Button>
          </form>
        </div>
        {areas.length > 0 && (
          <div className="glass-1 grid overflow-hidden rounded-[20px]" style={{ gridTemplateColumns: `repeat(${Math.min(areas.length, 3)}, minmax(0, 1fr))` }}>
            {areas.map(({ area, total: n }, i) => <BlocoDaArea key={area} area={area} total={n} largo={i > 0} ativo={filtro.area === area} aoClicar={() => mudar({ area: filtro.area === area ? null : area })} />)}
          </div>
        )}
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-28 sm:px-6 md:pb-12" aria-label="Vagas abertas">
        {total > 0 && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* No celular os filtros rolam de lado com o dedo, em vez de quebrar em várias linhas. */}
            <div className="flex max-w-full gap-0.5 self-start overflow-x-auto rounded-[14px] bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtros">
              {chip(filtro.area === null && filtro.especial === null, `Todas · ${total}`, null, () => mudar({ area: null, especial: null }))}
              {areas.map(({ area }) => chip(filtro.area === area, ROTULO_DA_AREA[area], area, () => mudar({ area: filtro.area === area ? null : area })))}
              {vagas!.some(v => v.aprendizagem || v.contratacao === 'aprendiz') && chip(filtro.especial === 'aprendiz', 'Jovem Aprendiz', null, () => mudar({ especial: filtro.especial === 'aprendiz' ? null : 'aprendiz' }))}
              {vagas!.some(v => v.afirmativa_pcd) && chip(filtro.especial === 'pcd', 'Vagas afirmativas PcD', null, () => mudar({ especial: filtro.especial === 'pcd' ? null : 'pcd' }))}
            </div>
            <div className="flex items-center justify-between gap-3 lg:contents">
            {(comum.contratacao || comum.cidade) && (
              <p className="text-[13px] text-muted-foreground lg:order-first lg:hidden">
                Todas{comum.contratacao && <> <b className="font-semibold text-foreground">{ROTULO_DA_CONTRATACAO[comum.contratacao]}</b></>}{comum.cidade && <>, em <b className="font-semibold text-foreground">{comum.cidade.replace(/\/SP$/, '')}</b></>}.
              </p>
            )}
            <div className="inline-flex shrink-0 self-end rounded-[14px] bg-muted p-1 lg:self-auto" role="group" aria-label="Ver as vagas como">
              {([['grade', 'Grade', LayoutGrid], ['lista', 'Lista', List]] as const).map(([v, rotulo, Icone]) => (
                <button key={v} type="button" aria-pressed={vista === v} onClick={() => trocarVista(v)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition ${vista === v ? 'bg-card text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'text-muted-foreground hover:text-foreground'}`}>
                  {rotulo}
                </button>
              ))}
            </div>
            </div>
          </div>
        )}
        {total > 0 && (comum.contratacao || comum.cidade) && (
          <p className="hidden text-[13.5px] text-muted-foreground lg:block">
            Todas{comum.contratacao && <> <b className="font-semibold text-foreground">{ROTULO_DA_CONTRATACAO[comum.contratacao]}</b></>}{comum.cidade && <>, em <b className="font-semibold text-foreground">{comum.cidade.replace(/\/SP$/, '')}</b></>}. Inscrições abertas.
          </p>
        )}

        {erro ? (
          <div className="flex flex-col items-start gap-3 rounded-[20px] border border-black/5 bg-card p-6 dark:border-white/5">
            <p className="font-semibold">Não deu para carregar as vagas.</p>
            <p className="text-sm text-muted-foreground">Confira a internet e tente de novo.</p>
            <Button variant="outline" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Button>
          </div>
        ) : vagas === null ? (
          <div className="grid gap-2.5 sm:gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Carregando vagas">
            {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-[124px] rounded-[22px] sm:h-[168px] sm:rounded-[24px]" />)}
          </div>
        ) : total === 0 ? (
          <Vazio titulo="Nenhuma vaga aberta agora." texto="Quando abrir uma vaga, ela aparece aqui primeiro." />
        ) : lista.length === 0 ? (
          <Vazio
            titulo={filtro.busca ? `Nada encontrado para "${filtro.busca}".` : 'Nenhuma vaga com esses filtros.'}
            texto="Tente outra palavra ou veja todas as vagas."
            acao={<Button variant="outline" onClick={() => { setBusca(''); setParams(manterTela(new URLSearchParams()), { replace: true }); }}>Ver todas as vagas</Button>}
          />
        ) : (
          <>
            {temFiltro && <p className="text-sm text-muted-foreground" aria-live="polite">{vagasNoPlural(lista.length)}{filtro.busca ? ` para "${filtro.busca}"` : ''}</p>}
            {comuns.length > 0 && <div className={grade}>{comuns.map(v => <CartaoDaVaga key={v.id} vaga={v} vista={vista} comum={comum} />)}</div>}
            {programas.length > 0 && (
              <section aria-label="Programas para todos" className={`flex flex-col gap-1.5 ${comuns.length ? 'mt-4 border-t border-border pt-6' : ''}`}>
                <h2 className="text-lg font-bold">Programas para todos</h2>
                <p className="mb-2 text-sm text-muted-foreground">Vagas garantidas por lei, com inscrição própria.</p>
                <div className={grade}>{programas.map(v => <CartaoDaVaga key={v.id} vaga={v} vista={vista} comum={comum} />)}</div>
              </section>
            )}
          </>
        )}
      </section>
    </>
  );
}

function BlocoDaArea({ area, total, largo, ativo, aoClicar }: { area: Area; total: number; largo: boolean; ativo: boolean; aoClicar: () => void }) {
  const Icone = ICONE_DA_AREA[area];
  return (
    // Esboço V2: cada área é uma célula da faixa de números (vidro), com a bolinha da cor.
    <button
      type="button"
      aria-pressed={ativo}
      aria-label={`${ROTULO_DA_AREA[area]} ${total} ${total === 1 ? 'vaga aberta' : 'vagas abertas'}`}
      onClick={aoClicar}
      className={`flex flex-col gap-1 p-4 text-left transition-colors sm:p-5 ${largo ? 'border-l border-black/10 dark:border-white/10' : ''} ${ativo ? 'bg-[hsl(var(--ativo))]' : 'hover:bg-[hsl(var(--ativo))]'}`}
    >
      <span className="font-display text-[30px] font-bold leading-none tabular-nums text-foreground sm:text-[34px]">{total}</span>
      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <PontoDaArea area={area} />
        <span className={ativo ? 'font-semibold text-foreground' : ''}>{ROTULO_DA_AREA[area]}</span>
      </span>
    </button>
  );
}

function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[20px] border border-dashed border-border p-6">
      <p className="text-lg font-semibold">{titulo}</p>
      <p className="text-sm text-muted-foreground">{texto}</p>
      {acao && <div className="pt-2">{acao}</div>}
    </div>
  );
}

