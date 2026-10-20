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

const COR_DA_ETAPA: Record<Etapa, string> = {
  recebida: 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  analise: 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  entrevista: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  resultado: 'bg-muted text-foreground',
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

  return (
    <MolduraDasVagas>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <Link to={isRh ? "/vagas?tela=processos" : "/vagas"} className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {isRh ? "Processos" : "Meus processos"}</Link>
        {vaga === null ? (
          <p className="text-muted-foreground">Vaga não encontrada.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{vaga?.titulo ?? 'Carregando…'}</h1>
                {vaga && <p className="text-sm text-muted-foreground">{vaga.codigo} · {contagem.todas} {contagem.todas === 1 ? 'candidato' : 'candidatos'}</p>}
              </div>
              <div className="flex gap-2">
                {/* A planilha tem nome, e-mail e WhatsApp: só o RH, e cada download fica na auditoria (passo 6, 20/10/2026). */}
                {isRh && <Button variant="outline" size="sm" disabled={!vistas.length} onClick={() => { baixarArquivo(csvDosCandidatos(vistas), `candidatos-${slug}.csv`); if (vaga) registrarAcesso('planilha.baixada', { vaga: vaga.id, detalhe: `${vistas.length} ${vistas.length === 1 ? 'linha' : 'linhas'}` }); }}><Download className="h-4 w-4" /> Baixar planilha</Button>}
                {vaga && <Button asChild variant="outline" size="sm"><Link to={`/vagas/${vaga.slug}`}>Ver a vaga</Link></Button>}
              </div>
            </div>

            {ver && (
              <p className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
                Mostrando só {ver === 'novos' ? 'os novos (ninguém abriu)' : ver === 'respostas' ? 'quem respondeu e ainda não foi lido' : 'os parados há 10+ dias'}.
                <button type="button" className="font-semibold underline" onClick={() => { const p = new URLSearchParams(params); p.delete('ver'); setParams(p, { replace: true }); }}>Ver todos</button>
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl bg-muted p-1" role="group" aria-label="Quadro ou lista">
                {(['quadro', 'lista'] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={vista === v} onClick={() => escolherVista(v)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>{v === 'quadro' ? 'Quadro' : 'Lista'}</button>
                ))}
              </div>
              {vista === 'lista' && <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por etapa">
                {filtros.map(([k, r]) => (
                  <Button key={k} size="sm" variant={filtro === k ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setFiltro(k)}>
                    {r}<span className="opacity-60">{contagem[k] ?? 0}</span>
                  </Button>
                ))}
              </div>}
              <label className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Buscar por nome ou cidade" placeholder="Buscar por nome ou cidade" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </label>
            </div>

            {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">Não consegui carregar os candidatos. Recarregue a página.</p>}

            {lista === null ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : vista === 'quadro' ? (
              <QuadroDeCandidatos slug={slug} lista={vistas} desde={desde} naoLidas={naoLidas} podeFechar={isRh} aoMudar={() => setVersao((n) => n + 1)} />
            ) : vistas.length === 0 ? (
              <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">{(lista ?? []).length ? 'Ninguém nesta etapa.' : 'Ninguém se candidatou ainda.'}</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="p-3">Candidato</th><th className="p-3">Formação</th><th className="p-3">Requisitos</th><th className="p-3">Currículo</th><th className="p-3">Enviada</th><th className="p-3">Etapa</th></tr>
                  </thead>
                  <tbody>
                    {vistas.map((c) => {
                      const nome = nomeDoCandidato(c);
                      const ir = () => navigate(`/vagas/${slug}/candidatos/${c.id}`);
                      return (
                        <tr key={c.id} className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={ir} data-testid="candidato">
                          <td className="p-3">
                            <button type="button" onClick={(e) => { e.stopPropagation(); ir(); }} className="flex items-center gap-2.5 text-left">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">{iniciais(nome)}</span>
                              <span><b className="block">{nome}</b><span className="text-xs text-muted-foreground">{lugarDe(c) || '—'}</span></span>
                            </button>
                          </td>
                          <td className="p-3">{escolaridadeDe(c)}<span className="block text-xs text-muted-foreground">{experienciasDe(c).length ? `${experienciasDe(c).length} ${experienciasDe(c).length === 1 ? 'experiência' : 'experiências'}` : 'sem experiência'}</span></td>
                          <td className="p-3 tabular-nums">{c.requisitos.length ? `${c.requisitos.filter((r) => r.atende).length} de ${c.requisitos.length}` : '—'}</td>
                          <td className="p-3">{c.curriculo_caminho ? <span className="font-bold text-emerald-700 dark:text-emerald-400">✓</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="p-3">{quando(c.created_at)}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.retirada_em ? 'bg-muted text-muted-foreground' : COR_DA_ETAPA[c.etapa]}`}>{c.retirada_em ? 'Retirada' : rotuloDaEtapa(c.etapa, c.resultado)}</span>
                            {!c.aberta_em && !c.retirada_em && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-950/60 dark:text-red-300">novo</span>}
                            {naoLidas.has(c.id) && <span className="ml-1.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">respondeu</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </MolduraDasVagas>
  );
}
