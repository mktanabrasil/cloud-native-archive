import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Lock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { MolduraDasVagas } from '@/components/vagas/PecasDasVagas';
import { QuadroDeCandidatos } from '@/components/vagas/QuadroDeCandidatos';
import { baixarArquivo } from '@/lib/enquetes/planilha';
import { ETAPAS, rotuloDaEtapa, type Etapa } from '@/lib/vagas/candidatura';
import type { Vaga } from '@/lib/vagas/modelo';
import {
  buscarVagaDoRh, candidatosDaVaga, semAcento, csvDosCandidatos, estaParado, ultimaMudanca, escolaridadeDe, experienciasDe, iniciais, lugarDe, nomeDoCandidato,
  type CandidaturaRh,
} from '@/lib/vagas/rh';
import { respostasNaoLidas } from '@/lib/vagas/mensagens';
import { registrarAcesso } from '@/lib/vagas/auditoria';

/**
 * /vagas/:slug/candidatos — os candidatos de uma vaga, para o RH (PR 9,
 * mockup de 09/10/2026). Filtro por etapa com a contagem, busca por nome ou
 * cidade, planilha, e a linha abre a ficha. Só RH e admin.
 */

type Filtro = 'todas' | Etapa | 'retiradas';

// Esboço V2: a etapa é texto com bolinha, na cor de texto legível.
const COR_DA_ETAPA: Record<Etapa, string> = {
  recebida: 'text-info',
  analise: 'text-warning',
  entrevista: 'text-success',
  resultado: 'text-foreground',
};

const quando = (iso: string) => {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
};


export default function CandidatosDaVagaPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { isRh, loading } = useUserRole();
  const { user } = useAuth();
  const [vaga, setVaga] = useState<Vaga | null | undefined>(undefined);
  const [lista, setLista] = useState<CandidaturaRh[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState(false);
  // Quadro ou lista (decisão de 19/10/2026: abre no quadro; o app lembra a escolha).
  const [vista, setVista] = useState<'quadro' | 'lista'>(() => { try { return localStorage.getItem('vagas-rh-vista') === 'lista' ? 'lista' : 'quadro'; } catch { return 'quadro'; } });
  const escolherVista = (v: 'quadro' | 'lista') => { setVista(v); setFiltro('todas'); try { localStorage.setItem('vagas-rh-vista', v); } catch { /* segue */ } };
  // ?ver=novos|parados|respostas: vindo do "Pede atenção" do Painel.
  const [params, setParams] = useSearchParams();
  const ver = (['novos', 'parados', 'respostas'] as const).find((v) => v === params.get('ver')) ?? null;
  const [naoLidas, setNaoLidas] = useState<Map<string, number>>(new Map());
  const [desde, setDesde] = useState<Map<string, string>>(new Map());
  const [versao, setVersao] = useState(0);
  useTituloDaAba(`${vaga?.titulo ? `Candidatos · ${vaga.titulo}` : 'Candidatos'} · Trabalhe Conosco`);

  useEffect(() => {
    // O responsável pelo processo também entra (passo 3): o banco só entrega a vaga se for dele.
    if (!user?.id) return;
    (async () => {
      try {
        const v = await buscarVagaDoRh(slug);
        setVaga(v);
        if (v) {
          const l = await candidatosDaVaga(v.id);
          setLista(l);
          setDesde(await ultimaMudanca(l.map((c) => c.id)).catch(() => new Map()));
          setNaoLidas(await respostasNaoLidas().catch(() => new Map()));
        }
      } catch { setErro(true); setLista([]); }
    })();
  }, [user?.id, slug, versao]);

  const comVer = useMemo(() => (lista ?? []).filter((c) =>
    ver === 'novos' ? !c.aberta_em && !c.retirada_em
      : ver === 'respostas' ? naoLidas.has(c.id)
      : ver === 'parados' ? !c.retirada_em && c.etapa !== 'resultado' && !!c.aberta_em && estaParado(desde.get(c.id))
        : true), [lista, ver, desde, naoLidas]);

  const contagem = useMemo(() => {
    const l = lista ?? [];
    const ativas = l.filter((c) => !c.retirada_em);
    return {
      todas: ativas.length,
      retiradas: l.length - ativas.length,
      ...Object.fromEntries(ETAPAS.map(([k]) => [k, ativas.filter((c) => c.etapa === k).length])),
    } as Record<Filtro, number>;
  }, [lista]);

  const vistas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return comVer
      .filter((c) => (filtro === 'retiradas' ? !!c.retirada_em : !c.retirada_em && (filtro === 'todas' || c.etapa === filtro)))
      .filter((c) => !termo || semAcento(`${nomeDoCandidato(c)} ${lugarDe(c)}`).includes(termo));
  }, [comVer, filtro, busca]);

  if (loading) return null;
  const permitido = isRh || (!!vaga && vaga.responsavel_id === user?.id);
  if (!permitido && vaga !== undefined) {
    return (
      <MolduraDasVagas>
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
          <Lock className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">Os candidatos são do RH e de quem é responsável pelo processo.</p>
        </div>
      </MolduraDasVagas>
    );
  }

  const filtros: Array<[Filtro, string]> = [['todas', 'Todas'], ...ETAPAS.map(([k, r]) => [k, r] as [Filtro, string]), ['retiradas', 'Retiradas']];

  // Esboço V2: abas segmentadas com contagem, etapa em texto com bolinha; a lista é uma só marcação
  // que vira tabela no computador e linha empilhada no celular (sem rolar para o lado).
  const segmento = 'inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[14px] bg-muted p-1';
  const opcao = (ativa: boolean) => `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors ${ativa ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`;
  const COLUNAS = 'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_90px_80px_96px_minmax(0,1.3fr)] md:items-center md:gap-4';

  return (
    <MolduraDasVagas>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <Link to={isRh ? "/vagas?tela=processos" : "/vagas"} className="flex min-h-[32px] items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {isRh ? "Processos" : "Meus processos"}</Link>
        {vaga === null ? (
          <p className="text-muted-foreground">Vaga não encontrada.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[28px] font-bold leading-tight">{vaga?.titulo ?? 'Carregando…'}</h1>
                {vaga && <p className="text-sm text-muted-foreground"><span className="tabular-nums">{vaga.codigo}</span> · {contagem.todas} {contagem.todas === 1 ? 'candidato' : 'candidatos'}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* A planilha tem nome, e-mail e WhatsApp: só o RH, e cada download fica na auditoria (passo 6, 20/10/2026). */}
                {isRh && <Button variant="outline" size="sm" disabled={!vistas.length} onClick={() => { baixarArquivo(csvDosCandidatos(vistas), `candidatos-${slug}.csv`); if (vaga) registrarAcesso('planilha.baixada', { vaga: vaga.id, detalhe: `${vistas.length} ${vistas.length === 1 ? 'linha' : 'linhas'}` }); }}><Download className="h-4 w-4" /> Baixar planilha</Button>}
                {vaga && <Button asChild variant="ghost" size="sm"><Link to={`/vagas/${vaga.slug}`}>Ver a vaga</Link></Button>}
              </div>
            </div>

            {ver && (
              <p className="flex flex-wrap items-center gap-2 self-start rounded-[16px] border border-border bg-card px-3.5 py-2 text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                Mostrando só {ver === 'novos' ? 'os novos (ninguém abriu)' : ver === 'respostas' ? 'quem respondeu e ainda não foi lido' : 'os parados há 10+ dias'}.
                <button type="button" className="font-semibold text-[hsl(var(--sel,168_80%_27%))] hover:underline" onClick={() => { const p = new URLSearchParams(params); p.delete('ver'); setParams(p, { replace: true }); }}>Ver todos</button>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <div className={segmento} role="group" aria-label="Quadro ou lista">
                {(['quadro', 'lista'] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={vista === v} onClick={() => escolherVista(v)} className={opcao(vista === v)}>{v === 'quadro' ? 'Quadro' : 'Lista'}</button>
                ))}
              </div>
              {vista === 'lista' && <div className={segmento} role="group" aria-label="Filtrar por etapa">
                {filtros.map(([k, r]) => (
                  <button key={k} type="button" aria-pressed={filtro === k} className={opcao(filtro === k)} onClick={() => setFiltro(k)}>
                    {r}<span className="tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">{contagem[k] ?? 0}</span>
                  </button>
                ))}
              </div>}
              <span className="flex-1" />
              <label className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Buscar por nome ou cidade" placeholder="Buscar por nome ou cidade" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </label>
            </div>

            {erro && <p role="alert" className="text-sm font-semibold text-destructive">Não consegui carregar os candidatos. Recarregue a página.</p>}

            {lista === null ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : vista === 'quadro' ? (
              <QuadroDeCandidatos slug={slug} lista={vistas} desde={desde} naoLidas={naoLidas} podeFechar={isRh} aoMudar={() => setVersao((n) => n + 1)} />
            ) : vistas.length === 0 ? (
              <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">{(lista ?? []).length ? 'Ninguém nesta etapa.' : 'Ninguém se candidatou ainda.'}</p>
            ) : (
              <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card text-sm dark:border-white/5">
                <div className={`hidden border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground ${COLUNAS}`} aria-hidden>
                  <span>Candidato</span><span>Formação</span><span>Requisitos</span><span>Currículo</span><span>Enviada</span><span>Etapa</span>
                </div>
                {vistas.map((c) => {
                  const nome = nomeDoCandidato(c);
                  const ir = () => navigate(`/vagas/${slug}/candidatos/${c.id}`);
                  const exp = experienciasDe(c).length;
                  return (
                    <div key={c.id} className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/70 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40 ${COLUNAS}`} onClick={ir} data-testid="candidato">
                      <div className="basis-full md:basis-auto">
                        <button type="button" onClick={(e) => { e.stopPropagation(); ir(); }} className="flex min-w-0 items-center gap-2.5 text-left">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-foreground">{iniciais(nome)}</span>
                          <span className="min-w-0"><b className="block truncate font-semibold">{nome}</b><span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{lugarDe(c) || '—'}</span></span>
                        </button>
                      </div>
                      <div className="text-xs text-muted-foreground md:text-sm md:text-foreground">{escolaridadeDe(c)}<span className="hidden text-xs text-[hsl(var(--fraco,0_0%_45%))] md:block">{exp ? `${exp} ${exp === 1 ? 'experiência' : 'experiências'}` : 'sem experiência'}</span></div>
                      <div className="text-xs tabular-nums text-muted-foreground md:text-sm md:text-foreground">{c.requisitos.length ? <>{c.requisitos.filter((r) => r.atende).length} de {c.requisitos.length}<span className="md:hidden"> requisitos</span></> : <span className="hidden md:inline">—</span>}</div>
                      <div className="text-xs text-muted-foreground md:text-sm">{c.curriculo_caminho ? <><span className="font-bold text-success">✓</span><span className="md:hidden"> currículo</span></> : <span className="hidden md:inline">—</span>}</div>
                      <div className="text-xs text-muted-foreground md:text-sm md:text-foreground">{quando(c.created_at)}</div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold ${c.retirada_em ? 'text-muted-foreground' : COR_DA_ETAPA[c.etapa]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{c.retirada_em ? 'Retirada' : rotuloDaEtapa(c.etapa, c.resultado)}</span>
                        {!c.aberta_em && !c.retirada_em && <span className="text-xs font-semibold text-destructive">novo</span>}
                        {naoLidas.has(c.id) && <span className="text-xs font-semibold text-info">respondeu</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </MolduraDasVagas>
  );
}
