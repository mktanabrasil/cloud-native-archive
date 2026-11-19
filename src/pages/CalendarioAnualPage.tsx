import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, HelpCircle, LogOut } from 'lucide-react';
import { JournalTutorial } from '@/components/journal/JournalTutorial';
import { useTutoriaisVistos } from '@/hooks/useTutoriaisVistos';
import { ROTEIROS_DO_CALENDARIO, type RoteiroDoCalendario } from '@/lib/calendario/tutorial';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ROTAS_DO_CANDIDATO, ehCandidato, primeiroNome } from '@/lib/vagas/conta';
import { ehContaDoCalendario } from '@/lib/calendario/conta';
import { ANO_DO_CALENDARIO, lerAlteracoes, lerAno, lerFolhasExtras, lerItens } from '@/lib/calendario/api';
import { aberto, atividadeEhMinha, folhaEhMinha, itensAbertos, noFichario, unidadeDoCalendario, type AlteracaoDoCalendario, type AnoDoCalendario, type FolhaExtra, type ItemDoCalendario } from '@/lib/calendario/regras';
import { EditorDaFolhaExtra } from '@/components/calendario/FolhasExtras';
import { MolduraDoCalendario } from '@/components/calendario/MolduraDoCalendario';
import AppLayout from '@/components/AppLayout';
import { ROTAS } from '@/config/navigation';
import { InicioDoCalendario, type Parte } from '@/components/calendario/InicioDoCalendario';
import { PercursosDoAno } from '@/components/calendario/PercursosDoAno';
import { TextosDoProjeto } from '@/components/calendario/TextosDoProjeto';
import { PreviaDoPdf } from '@/components/calendario/PreviaDoPdf';
import { RevisaoDoMarketing } from '@/components/calendario/RevisaoDoMarketing';
import { MesAMes } from '@/components/calendario/MesAMes';
import { BaixarDoFichario } from '@/components/calendario/BaixarDoFichario';

/**
 * /social/calendario (14/11/2026): o Calendário Anual dos educadores, uma
 * página do setor Social.
 *
 * Desde 17/11/2026 não há lista de acesso nem entrada própria: quem preenche
 * é a gestão de cada unidade do Social (e o marketing, que revisa e monta o
 * PDF), pela regra do setor; o login é o do app.
 *
 * - Sem sessão: o login do app, que volta para cá.
 * - Marketing e gestão do Social: o preenchimento, dentro do app.
 * - O resto da equipe: o calendário de eventos, que mora na aba do hub
 *   (este endereço era dele até 14/11/2026).
 * - Conta antiga "só do calendário" (de antes de 17/11): um aviso.
 */
export default function CalendarioAnualPage() {
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const { isMarketing, temCalendarioAnual, unit, loading: carregandoPapel } = useUserRole();
  const location = useLocation();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (ehCandidato(user)) return <Navigate to={ROTAS_DO_CANDIDATO.minhaArea} replace />;
  if (ehContaDoCalendario(user)) {
    const sair = (
      <span className="flex items-center gap-2">
        <span className="hidden text-muted-foreground sm:inline">{primeiroNome(user)}</span>
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => void signOut()}><LogOut className="h-4 w-4" /> Sair</Button>
      </span>
    );
    return <MolduraDoCalendario atalho={sair}><ContaAntiga /></MolduraDoCalendario>;
  }
  if (carregandoPapel) return null;
  // Quem não preenche segue para o calendário de eventos, no hub.
  if (!temCalendarioAnual) {
    const resto = new URLSearchParams(location.search); resto.delete('parte'); resto.delete('m');
    return <Navigate to={`${ROTAS.eventos}?tela=calendario${resto.toString() ? `&${resto}` : ''}`} replace />;
  }
  return (
    <AppLayout>
      <TituloDaAba />
      <Preenchimento nome={String(user?.user_metadata?.name ?? '') || user?.email || ''} marketing={isMarketing} email={user?.email ?? null} unidade={unidadeDoCalendario(unit)} />
    </AppLayout>
  );
}

/** A conta antiga "só do calendário": o calendário agora é pela conta da equipe. */
function ContaAntiga() {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="glass-2 rounded-[22px] p-6 text-center" role="status">
        <h1 className="font-display text-[22px] font-bold">O Calendário Anual mudou de lugar</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Agora ele é preenchido pela gestão de cada unidade do Social, dentro do app, com a conta da equipe. Saia e entre com o e-mail da gestão da sua unidade.
        </p>
      </div>
    </div>
  );
}

/** O nome da aba do navegador, igual ao da moldura própria. */
function TituloDaAba() {
  useEffect(() => {
    const antes = document.title;
    document.title = 'Calendário Anual · ANA Brasil';
    return () => { document.title = antes; };
  }, []);
  return null;
}

/** O preenchimento: só chega aqui quem pode (ver acima); o banco confere de novo. */
function Preenchimento({ nome, marketing, email, unidade }: { nome: string; marketing: boolean; email: string | null; unidade: string | null }) {
  const [params, setParams] = useSearchParams();
  const parte = (params.get('parte') as Parte | null) ?? 'inicio';
  const mes = Math.min(12, Math.max(1, Number(params.get('m')) || 1));
  const folhaPedida = params.get('f');
  const [estado, setEstado] = useState<'carregando' | 'fechado' | 'erro' | 'pronto'>('carregando');
  const [ano, setAno] = useState<AnoDoCalendario | null>(null);
  const [itens, setItens] = useState<ItemDoCalendario[]>([]);
  const [alteracoes, setAlteracoes] = useState<AlteracaoDoCalendario[]>([]);
  const [extras, setExtras] = useState<FolhaExtra[]>([]);
  // A prévia de uma folha extra só (o editor), ou do calendário inteiro.
  const [previaDaFolha, setPreviaDaFolha] = useState<FolhaExtra | null>(null);
  const [previaAberta, setPreviaAberta] = useState(false);
  // O fichário (19/11/2026): baixar para imprimir; com um mês, só ele vem marcado.
  const [baixar, setBaixar] = useState<{ mes: number | null } | null>(null);
  // O tutorial (13/11/2026): abre sozinho na primeira vez de cada roteiro.
  const tutoriais = useTutoriaisVistos();
  const roteiro: RoteiroDoCalendario | null = parte === 'inicio' ? 'calendario-inicio' : parte === 'mes' ? 'calendario-mes' : null;
  const [tutorialAberto, setTutorialAberto] = useState(false);
  useEffect(() => {
    if (estado === 'pronto' && roteiro && tutoriais.carregado && !tutoriais.jaViu(roteiro)) setTutorialAberto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, roteiro, tutoriais.carregado]);

  const carregar = useCallback(async () => {
    try {
      // As folhas extras (19/11/2026) vêm junto (vazio sem o SQL 20261120100000): o link direto para uma folha já a encontra.
      const [a, i, x] = await Promise.all([lerAno(ANO_DO_CALENDARIO), lerItens(ANO_DO_CALENDARIO), lerFolhasExtras(ANO_DO_CALENDARIO)]);
      if (!a) { setEstado(marketing ? 'erro' : 'fechado'); return; }
      setAno(a); setItens(i); setExtras(x); setEstado('pronto');
      // O fichário (19/11/2026): o que mudou depois da impressão.
      if (a.impresso_em) setAlteracoes(await lerAlteracoes(ANO_DO_CALENDARIO));
    } catch { setEstado('erro'); }
  }, [marketing]);
  // Cada mudança no mês a mês vira uma linha do registro (o banco grava); relê depois de mexer.
  const mudarItens = useCallback((novos: ItemDoCalendario[]) => {
    setItens(novos);
    if (ano?.impresso_em) void lerAlteracoes(ano.ano).then(setAlteracoes);
  }, [ano?.impresso_em, ano?.ano]);
  useEffect(() => { void carregar(); }, [carregar]);

  const abrir = (p: Parte, m?: number, f?: string) => {
    const n = new URLSearchParams();
    if (p !== 'inicio') n.set('parte', p);
    if (m) n.set('m', String(m));
    if (f) n.set('f', f);
    setParams(n);
    window.scrollTo?.({ top: 0 });
  };

  if (estado === 'carregando') return <p className="px-6 py-10 text-center text-[14px] text-muted-foreground">Carregando o calendário…</p>;
  if (estado === 'fechado') return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="glass-2 rounded-[22px] p-6 text-center" role="status">
        <h1 className="font-display text-[22px] font-bold">O Calendário Anual de {ANO_DO_CALENDARIO} ainda não foi aberto</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">O marketing abre o ano para o preenchimento. Quando abrir, ele aparece aqui.</p>
      </div>
    </div>
  );
  if (estado === 'erro' || !ano) return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p className="text-[14px]">Não consegui carregar o calendário agora.</p>
      <Button className="mt-3" onClick={() => { setEstado('carregando'); void carregar(); }}>Tentar de novo</Button>
    </div>
  );

  // No fichário (aprovado) a gestão mexe só nas atividades do mês a mês.
  const editavel = marketing || aberto(ano);
  const editavelItens = marketing || itensAbertos(ano);
  const fichario = noFichario(ano);
  // A atividade que veio de um evento confirmado sai pelo evento (cancelar, lixeira), nunca aqui.
  const podeApagar = (i: ItemDoCalendario) => !i.evento_id && (marketing || (i.tipo === 'atividade' && (!fichario || atividadeEhMinha(i, { email, unidade }))));
  // As folhas extras: a gestão cria no fichário; muda e apaga só as dela. O marketing, sempre.
  const podeCriarFolha = marketing || fichario;
  const podeMexerNaFolha = (f: FolhaExtra) => marketing || (fichario && folhaEhMinha(f, email));
  const folhaAberta = folhaPedida && folhaPedida !== 'nova' ? extras.find(f => f.id === folhaPedida) ?? null : null;
  const voltar = (
    <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 pb-2 lg:px-6">
      {parte !== 'inicio' ? <Button variant="ghost" size="sm" className="gap-1" onClick={() => abrir('inicio')}><ArrowLeft className="h-4 w-4" /> Início</Button> : <span />}
      {roteiro && <Button variant="ghost" size="sm" className="gap-1" data-tutorial="cal-ajuda" onClick={() => setTutorialAberto(true)}><HelpCircle className="h-4 w-4" /> Ver o tutorial</Button>}
    </div>
  );
  return (
    <>
      {voltar}
      {parte === 'percursos' && <PercursosDoAno ano={ano} editavel={editavel} onAno={setAno} />}
      {parte === 'textos' && <TextosDoProjeto ano={ano} editavel={editavel} onAno={setAno} />}
      {parte === 'mes' && <MesAMes ano={ano} itens={itens} editavel={editavelItens} editavelDoMes={editavel} fichario={fichario} alteracoes={alteracoes} podeApagar={podeApagar} onBaixar={m => setBaixar({ mes: m })} podeAbrirEvento={i => marketing || i.unidades.length === 0 || (!!unidade && i.unidades.includes(unidade))} mes={mes} onMes={m => abrir('mes', m)} onAno={setAno} onItens={mudarItens} />}
      {parte === 'extra' && (folhaPedida === 'nova' ? podeCriarFolha : !!folhaAberta) && (
        <EditorDaFolhaExtra key={folhaPedida ?? ''} ano={ano} itens={itens} folha={folhaAberta} podeMexer={folhaAberta ? podeMexerNaFolha(folhaAberta) : podeCriarFolha} unidadePadrao={marketing ? null : unidade}
          onSalva={f => { setExtras(xs => [...xs.filter(x => x.id !== f.id), f]); if (!folhaAberta) abrir('extra', undefined, f.id); }}
          onApagada={id => { setExtras(xs => xs.filter(x => x.id !== id)); abrir('inicio'); }}
          onPrevia={f => { setPreviaDaFolha(f); setPreviaAberta(true); }} />
      )}
      {parte === 'extra' && !(folhaPedida === 'nova' ? podeCriarFolha : !!folhaAberta) && <p className="px-6 py-10 text-center text-[14px] text-muted-foreground">{folhaPedida === 'nova' ? 'As folhas extras ficam abertas depois que o calendário é aprovado e impresso.' : 'Esta folha extra não existe mais.'}</p>}
      {parte === 'revisao' && marketing && <RevisaoDoMarketing ano={ano} itens={itens} extras={extras} alteracoes={alteracoes} quem={nome} onAno={setAno} onPrevia={() => { setPreviaDaFolha(null); setPreviaAberta(true); }} />}
      {(parte === 'inicio' || (parte === 'revisao' && !marketing)) && <InicioDoCalendario ano={ano} editavel={editavel} marketing={marketing} alteracoes={alteracoes} onAno={setAno} abrir={abrir} onPrevia={() => { setPreviaDaFolha(null); setPreviaAberta(true); }} onBaixar={fichario ? () => setBaixar({ mes: null }) : undefined}
        folhas={podeCriarFolha || extras.length ? { lista: extras, itens, podeCriar: podeCriarFolha, podeMexer: podeMexerNaFolha } : undefined} />}
      {fichario && <BaixarDoFichario ano={ano} itens={itens} extras={extras} alteracoes={alteracoes} marketing={marketing} unidade={unidade} mesInicial={baixar?.mes} aberto={!!baixar} onFechar={() => setBaixar(null)} />}
      <PreviaDoPdf ano={ano} itens={itens} extras={extras} soAFolha={previaDaFolha} podeBaixar={marketing} aberta={previaAberta} onFechar={() => { setPreviaAberta(false); setPreviaDaFolha(null); }} />
      {roteiro && (
        <JournalTutorial percurso={roteiro} passos={ROTEIROS_DO_CALENDARIO[roteiro].filter(p => !(fichario && p.alvo === 'cal-revisado'))} rotulo="Tutorial do Calendário Anual"
          aberto={tutorialAberto} onFechar={() => setTutorialAberto(false)} onVisto={() => tutoriais.marcarVisto(roteiro)} />
      )}
    </>
  );
}
