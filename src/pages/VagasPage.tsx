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
import { GestaoDeVagas } from '@/components/vagas/GestaoDeVagas';
import { CartaoDaVaga, COR_DA_AREA, ICONE_DA_AREA, MolduraDasVagas } from '@/components/vagas/PecasDasVagas';
import { guardarVista, separarProgramas, vistaGuardada, type Vista } from '@/lib/vagas/vitrine';
import { listarVagasPublicadas } from '@/lib/vagas/api';
import { ROTULO_DA_AREA, type Area, type Vaga } from '@/lib/vagas/modelo';
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
  const { isRh } = useUserRole();
  const { isAuthenticated, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [semEntrar, setSemEntrar] = useState(escolheuVerSemEntrar);
  const gestao = isRh && params.get('tela') === 'gestao';
  useTituloDaAba(gestao ? 'Gestão de vagas · ANA Brasil' : 'Trabalhe Conosco · ANA Brasil');
  // RH e admin veem as duas abas; o público só a vitrine, sem aba nenhuma.
  const abas = isRh ? (
    <nav aria-label="Vagas: portal e gestão" className="border-b border-border bg-muted/40">
      <div className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
        {([['Portal', false], ['Gestão', true]] as const).map(([rotulo, g]) => (
          <button
            key={rotulo}
            type="button"
            aria-current={gestao === g ? 'page' : undefined}
            onClick={() => setParams(g ? new URLSearchParams('tela=gestao') : new URLSearchParams(), { replace: true })}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold ${gestao === g ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
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
  return <MolduraDasVagas abas={abas}>{gestao ? <GestaoDeVagas /> : <Vitrine />}</MolduraDasVagas>;
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

  const mudar = (f: Partial<FiltroDaVitrine>) => setParams(enderecoDoFiltro({ ...filtro, ...f }), { replace: true });
  const lista = useMemo(() => (vagas ? filtrarVagas(vagas, filtro) : []), [vagas, filtro]);
  // Jovem Aprendiz e PcD vão no fim, separados (28/09/2026).
  const { comuns, programas } = useMemo(() => separarProgramas(lista), [lista]);
  const areas = useMemo(() => (vagas ? contagemPorArea(vagas) : []), [vagas]);
  const temFiltro = filtro.area !== null || filtro.especial !== null || filtro.busca !== '';
  const total = vagas?.length ?? 0;

  const chip = (ativo: boolean, rotulo: string, Icone: LucideIcon, aoClicar: () => void) => (
    <button
      key={rotulo}
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition active:scale-95 ${ativo ? 'bg-foreground text-background' : 'bg-muted text-foreground hover:bg-muted/70'}`}
    >
      <Icone className="h-4 w-4" aria-hidden />{rotulo}
    </button>
  );
  const grade = vista === 'lista' ? 'grid grid-cols-[minmax(0,1fr)] gap-2.5' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';

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
            className="flex max-w-[560px] gap-2.5"
            onSubmit={e => { e.preventDefault(); mudar({ busca }); }}
          >
            <label htmlFor="busca-vaga" className="sr-only">Buscar vaga</label>
            <div className="flex h-14 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-input bg-background px-4 focus-within:ring-2 focus-within:ring-ring">
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
            <Button type="submit" className="h-14 shrink-0 rounded-2xl px-5 text-base sm:px-6">Buscar</Button>
          </form>
        </div>
        {areas.length > 0 && (
          <div className={`grid gap-3 ${areas.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {areas.map(({ area, total: n }, i) => <BlocoDaArea key={area} area={area} total={n} largo={areas.length === 3 && i === 2} ativo={filtro.area === area} aoClicar={() => mudar({ area: filtro.area === area ? null : area })} />)}
          </div>
        )}
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-12 sm:px-6" aria-label="Vagas abertas">
        {total > 0 && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* No celular os filtros rolam de lado com o dedo, em vez de quebrar em várias linhas. */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtros">
              {chip(filtro.area === null && filtro.especial === null, `Todas · ${total}`, LayoutGrid, () => mudar({ area: null, especial: null }))}
              {areas.map(({ area }) => chip(filtro.area === area, ROTULO_DA_AREA[area], ICONE_DA_AREA[area], () => mudar({ area: filtro.area === area ? null : area })))}
              {vagas!.some(v => v.aprendizagem || v.contratacao === 'aprendiz') && chip(filtro.especial === 'aprendiz', 'Jovem Aprendiz', GraduationCap, () => mudar({ especial: filtro.especial === 'aprendiz' ? null : 'aprendiz' }))}
              {vagas!.some(v => v.afirmativa_pcd) && chip(filtro.especial === 'pcd', 'Vagas afirmativas PcD', Accessibility, () => mudar({ especial: filtro.especial === 'pcd' ? null : 'pcd' }))}
            </div>
            <div className="inline-flex shrink-0 self-end rounded-xl bg-muted p-[3px] lg:self-auto" role="group" aria-label="Ver as vagas como">
              {([['grade', 'Grade', LayoutGrid], ['lista', 'Lista', List]] as const).map(([v, rotulo, Icone]) => (
                <button key={v} type="button" aria-pressed={vista === v} onClick={() => trocarVista(v)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold transition ${vista === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icone className="h-[17px] w-[17px]" aria-hidden />{rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {erro ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6">
            <p className="font-semibold">Não deu para carregar as vagas.</p>
            <p className="text-sm text-muted-foreground">Confira a internet e tente de novo.</p>
            <Button variant="outline" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Button>
          </div>
        ) : vagas === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Carregando vagas">
            {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : total === 0 ? (
          <Vazio titulo="Nenhuma vaga aberta agora." texto="Quando abrir uma vaga, ela aparece aqui primeiro." />
        ) : lista.length === 0 ? (
          <Vazio
            titulo={filtro.busca ? `Nada encontrado para "${filtro.busca}".` : 'Nenhuma vaga com esses filtros.'}
            texto="Tente outra palavra ou veja todas as vagas."
            acao={<Button variant="outline" onClick={() => { setBusca(''); setParams(new URLSearchParams(), { replace: true }); }}>Ver todas as vagas</Button>}
          />
        ) : (
          <>
            {temFiltro && <p className="text-sm text-muted-foreground" aria-live="polite">{vagasNoPlural(lista.length)}{filtro.busca ? ` para "${filtro.busca}"` : ''}</p>}
            {comuns.length > 0 && <div className={grade}>{comuns.map(v => <CartaoDaVaga key={v.id} vaga={v} vista={vista} />)}</div>}
            {programas.length > 0 && (
              <section aria-label="Programas para todos" className={`flex flex-col gap-1.5 ${comuns.length ? 'mt-4 border-t border-border pt-6' : ''}`}>
                <h2 className="text-lg font-bold">Programas para todos</h2>
                <p className="mb-2 text-sm text-muted-foreground">Vagas garantidas por lei, com inscrição própria.</p>
                <div className={grade}>{programas.map(v => <CartaoDaVaga key={v.id} vaga={v} vista={vista} />)}</div>
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
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`flex min-h-[120px] flex-col justify-between gap-3 rounded-[20px] p-4 text-left text-[#1F2322] transition hover:-translate-y-1 hover:shadow-lg active:scale-[.98] sm:min-h-[140px] sm:p-5 ${largo ? 'col-span-2' : ''} ${ativo ? 'ring-4 ring-foreground/80 ring-offset-2 ring-offset-background' : ''}`}
      style={{ background: COR_DA_AREA[area] }}
    >
      <span className="flex items-center justify-between">
        <span className="text-lg font-bold sm:text-xl">{ROTULO_DA_AREA[area]}</span>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/55"><Icone className="h-5 w-5" aria-hidden /></span>
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-[32px] font-bold leading-none sm:text-[40px]">{total}</span>
        <span className="text-sm font-semibold">{total === 1 ? 'vaga aberta' : 'vagas abertas'}</span>
      </span>
    </button>
  );
}

function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl bg-muted/60 p-6">
      <p className="text-lg font-semibold">{titulo}</p>
      <p className="text-sm text-muted-foreground">{texto}</p>
      {acao && <div className="pt-2">{acao}</div>}
    </div>
  );
}

