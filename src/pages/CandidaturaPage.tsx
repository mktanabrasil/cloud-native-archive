import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { PassosComAviao } from '@/components/vagas/LinhaDeVoo';
import { MolduraDaConta } from '@/components/vagas/MolduraDaConta';
import { buscarVaga, listarPerguntas } from '@/lib/vagas/api';
import { ROTAS_DO_CANDIDATO, ehCandidato } from '@/lib/vagas/conta';
import type { PerguntaDeVaga, Vaga } from '@/lib/vagas/modelo';
import { ESCOLARIDADES, carregarPerfil, passosQueFaltam, type Experiencia, type Perfil } from '@/lib/vagas/perfil';
import {
  ORIGENS, candidaturaAtiva, copiaDoPerfil, dataEHora, enviarCandidatura, faltamResponder, mensagemDaCandidatura, respondida,
  type Candidatura, type Resposta,
} from '@/lib/vagas/candidatura';

/**
 * /vagas/:slug/candidatar — a candidatura no app (PR 8, mockup e decisões de
 * 06/10/2026). Quatro passos com o avião na linha: conferir o que vai junto
 * (perfil completo obrigatório; currículo opcional), marcar os requisitos,
 * responder as perguntas da vaga e enviar. No fim, o protocolo.
 */

const PASSOS = ['Conferir', 'Requisitos', 'Perguntas', 'Enviar'] as const;

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{rotulo}</span><b className="text-right font-semibold">{children}</b></div>;
}

function Escolha({ ativo, onClick, children, papel = 'button' }: { ativo: boolean; onClick: () => void; children: ReactNode; papel?: 'button' | 'checkbox' | 'radio' }) {
  return (
    <button type="button" role={papel === 'button' ? undefined : papel} aria-checked={papel === 'button' ? undefined : ativo} aria-pressed={papel === 'button' ? ativo : undefined} onClick={onClick}
      className={`rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ativo ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70'}`}>
      {children}
    </button>
  );
}

export default function CandidaturaPage() {
  const { slug = '' } = useParams();
  const { user, isAuthenticated, loading } = useAuth();
  const [vaga, setVaga] = useState<Vaga | null | undefined>(undefined);
  const [perguntas, setPerguntas] = useState<PerguntaDeVaga[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [exps, setExps] = useState<Experiencia[]>([]);
  const [ja, setJa] = useState<Candidatura | null>(null);
  const [falhaAoAbrir, setFalhaAoAbrir] = useState(false);
  const [passo, setPasso] = useState(0);
  const [atende, setAtende] = useState<Record<number, boolean>>({});
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [origem, setOrigem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState<Candidatura | null>(null);
  useTituloDaAba(`${vaga?.titulo ? `Candidatura · ${vaga.titulo}` : 'Candidatura'} · Trabalhe Conosco ANA Brasil`);

  const idDoCandidato = user && ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!idDoCandidato) return;
    (async () => {
      try {
        const v = await buscarVaga(slug);
        setVaga(v);
        if (!v) return;
        const [ps, p, ativa] = await Promise.all([listarPerguntas(v.id), carregarPerfil(idDoCandidato), candidaturaAtiva(idDoCandidato, v.id)]);
        setPerguntas(ps); setPerfil(p.perfil); setExps(p.experiencias); setJa(ativa);
      } catch {
        setFalhaAoAbrir(true);
      }
    })();
  }, [slug, idDoCandidato]);

  const aqui = `/vagas/${slug}/candidatar`;
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={`${ROTAS_DO_CANDIDATO.entrar}?volta=${encodeURIComponent(aqui)}`} replace />;
  // Conta da equipe (RH, admin…) não se candidata: explica em vez de devolver calado.
  if (!ehCandidato(user)) {
    return (
      <MolduraDaConta atalho={<Link to={`/vagas/${slug}`} className="text-foreground hover:text-primary">Vaga</Link>}>
        <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
          <h1 className="text-[26px] font-bold leading-tight">Você entrou com uma conta da equipe.</h1>
          <p className="text-muted-foreground">A candidatura é feita com uma conta de candidato. Saia e entre com ela, ou crie uma.</p>
          <Button asChild variant="outline" className="h-12 self-start rounded-xl px-6"><Link to={`/vagas/${slug}`}><ArrowLeft className="h-4 w-4" /> Voltar para a vaga</Link></Button>
        </div>
      </MolduraDaConta>
    );
  }

  const atalho = <Link to={ROTAS_DO_CANDIDATO.minhaArea} className="text-foreground hover:text-primary">Minha área</Link>;
  const carregando = vaga === undefined || (vaga && !perfil);

  if (falhaAoAbrir) {
    return <MolduraDaConta atalho={atalho}><p className="mx-auto max-w-xl px-4 py-10 text-muted-foreground">Não consegui abrir a candidatura. Confira a internet e recarregue a página.</p></MolduraDaConta>;
  }
  if (vaga === null) {
    return (
      <MolduraDaConta atalho={atalho}>
        <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
          <h1 className="text-[26px] font-bold">Esta vaga não está mais aberta.</h1>
          <Button asChild className="h-12 self-start rounded-xl px-6"><Link to="/vagas">Ver vagas abertas <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </MolduraDaConta>
    );
  }
  if (carregando || !vaga || !perfil) return <MolduraDaConta atalho={atalho}><p className="mx-auto max-w-xl px-4 py-10 text-muted-foreground">Abrindo…</p></MolduraDaConta>;

  if (ja && !enviada) {
    return (
      <MolduraDaConta atalho={atalho}>
        <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
          <h1 className="text-[26px] font-bold leading-tight">Você já se candidatou a esta vaga.</h1>
          <p className="text-muted-foreground">Protocolo <b className="text-foreground">{ja.protocolo}</b>, enviada em {dataEHora(ja.created_at)}.</p>
          <Button asChild className="h-12 self-start rounded-xl px-6"><Link to={`${ROTAS_DO_CANDIDATO.minhaArea}/${ja.id}`}>Acompanhar <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </MolduraDaConta>
    );
  }

  const faltamNoPerfil = passosQueFaltam(perfil, exps.length);
  const requisitos = vaga.requisitos;
  const escolaridade = ESCOLARIDADES.find(([k]) => k === perfil.escolaridade)?.[1] ?? '—';

  const muda = (id: string, r: Resposta) => { setRespostas((x) => ({ ...x, [id]: r })); setErro(null); };

  function avancar() {
    if (passo === 0 && faltamNoPerfil.length) { setErro('Complete o perfil antes de continuar.'); return; }
    if (passo === 2) {
      const falta = faltamResponder(perguntas, respostas);
      if (falta.length) { setErro(`Responda: ${falta.map((p) => `“${p.texto}”`).join(', ')}.`); return; }
    }
    setErro(null);
    setPasso((p) => Math.min(PASSOS.length - 1, p + 1));
    window.scrollTo?.({ top: 0 });
  }

  async function enviar() {
    if (!perfil || !vaga) return;
    setEnviando(true); setErro(null);
    try {
      const c = await enviarCandidatura({
        userId: user!.id,
        vagaId: vaga.id,
        perfil: copiaDoPerfil(perfil, exps, user!.email ?? ''),
        requisitos: requisitos.map((texto, i) => ({ texto, atende: !!atende[i] })),
        respostas: perguntas.filter((p) => respondida(respostas[p.id])).map((p) => ({ pergunta_id: p.id, texto: p.texto, tipo: p.tipo, resposta: respostas[p.id] })),
        origem,
        curriculo: perfil.curriculo_caminho ? { caminho: perfil.curriculo_caminho, nome: perfil.curriculo_nome ?? 'curriculo' } : null,
      });
      setEnviada(c);
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      setErro(mensagemDaCandidatura(e));
    } finally {
      setEnviando(false);
    }
  }

  const marcados = requisitos.filter((_, i) => atende[i]).length;

  return (
    <MolduraDaConta atalho={atalho}>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pb-10 pt-2 sm:px-6">
        <div className="flex flex-col gap-2">
          <PassosComAviao total={PASSOS.length} atual={enviada ? PASSOS.length - 1 : passo} concluidos={PASSOS.map((_, i) => !!enviada || i < passo)} />
          <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground" aria-live="polite">
            {enviada ? 'Enviada' : `${passo + 1} de ${PASSOS.length}`} · {vaga.titulo}
          </span>
        </div>

        {enviada ? (
          <div className="vg-pergunta flex flex-col gap-5">
            <h1 className="text-[28px] font-bold leading-tight">Candidatura enviada!</h1>
            <div className="grid gap-1 rounded-[18px] bg-emerald-50 p-4 text-center dark:bg-emerald-950/40">
              <span className="text-xs text-muted-foreground">Protocolo</span>
              <b className="text-2xl tabular-nums tracking-wide" data-testid="protocolo">{enviada.protocolo}</b>
              <span className="text-xs text-muted-foreground">{vaga.titulo} · {dataEHora(enviada.created_at)}</span>
            </div>
            <ol className="grid gap-2.5 text-sm">
              {['Confirmação no seu e-mail.', 'O RH analisa as candidaturas.', 'Se avançar, você é avisado aqui e por e-mail.'].map((t, i) => (
                <li key={t} className="flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>{t}</li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="h-12 rounded-xl px-6"><Link to={`${ROTAS_DO_CANDIDATO.minhaArea}/${enviada.id}`}>Acompanhar <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" className="h-12 rounded-xl px-6"><Link to="/vagas">Ver vagas</Link></Button>
            </div>
          </div>
        ) : (
          <div key={passo} className="vg-pergunta flex flex-col gap-4">
            {passo === 0 && (
              <>
                <h1 className="text-[26px] font-bold leading-tight sm:text-[30px]">{faltamNoPerfil.length ? 'Falta pouco no seu perfil' : 'Confira o que vai junto'}</h1>
                {faltamNoPerfil.length ? (
                  <>
                    <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Complete antes de enviar: {faltamNoPerfil.map((f) => f.nome).join(' e ')}.
                    </p>
                    <ul className="grid gap-2">
                      {faltamNoPerfil.map((f) => (
                        <li key={f.passo}>
                          <Link to={`${ROTAS_DO_CANDIDATO.meuPerfil}?passo=${f.passo}&volta=${encodeURIComponent(aqui)}`} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-3 text-sm font-medium hover:bg-muted">
                            {f.nome} <span className="flex items-center gap-1 text-sky-700 dark:text-sky-400">Preencher <ChevronRight className="h-4 w-4" /></span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <div className="grid gap-2 rounded-2xl bg-muted/60 p-4" data-testid="resumo-do-perfil">
                      <Linha rotulo="Nome">{perfil.nome_social || perfil.nome}</Linha>
                      <Linha rotulo="WhatsApp">{perfil.whatsapp}</Linha>
                      <Linha rotulo="Cidade">{perfil.cidade}</Linha>
                      <Linha rotulo="Formação">{escolaridade}</Linha>
                      <Linha rotulo="Experiências">{perfil.sem_experiencia && exps.length === 0 ? 'Nenhuma' : exps.length}</Linha>
                      <Linha rotulo="Currículo">{perfil.curriculo_nome ? <span className="inline-flex items-center gap-1"><Check className="h-4 w-4 text-emerald-600" />{perfil.curriculo_nome}</span> : 'Não enviado (opcional)'}</Linha>
                    </div>
                    <Link to={`${ROTAS_DO_CANDIDATO.meuPerfil}?volta=${encodeURIComponent(aqui)}`} className="self-start text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400">Editar perfil ›</Link>
                  </>
                )}
              </>
            )}

            {passo === 1 && (
              <>
                <h1 className="text-[26px] font-bold leading-tight sm:text-[30px]">Marque o que você atende</h1>
                {requisitos.length === 0 ? (
                  <p className="text-muted-foreground">Esta vaga não lista requisitos. Pode seguir.</p>
                ) : (
                  <div className="grid gap-2" role="group" aria-label="Requisitos da vaga">
                    {requisitos.map((r, i) => (
                      <button key={r} type="button" role="checkbox" aria-checked={!!atende[i]} onClick={() => setAtende((a) => ({ ...a, [i]: !a[i] }))}
                        className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-3 text-left text-sm hover:bg-muted">
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 ${atende[i] ? 'border-foreground bg-foreground text-background' : 'border-border bg-background'}`}>{atende[i] && <Check className="h-4 w-4" />}</span>
                        {r}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">Não elimina ninguém: ajuda o RH a conhecer você.</p>
              </>
            )}

            {passo === 2 && (
              <>
                <h1 className="text-[26px] font-bold leading-tight sm:text-[30px]">{perguntas.length ? 'Perguntas da vaga' : 'Só mais uma coisa'}</h1>
                {perguntas.map((p) => {
                  const id = `pg-${p.id}`;
                  const r = respostas[p.id];
                  return (
                    <div key={p.id} className="flex flex-col gap-2">
                      <label htmlFor={id} className="text-sm font-semibold">{p.texto}{!p.obrigatoria && <span className="font-normal text-muted-foreground"> (opcional)</span>}</label>
                      {p.tipo === 'texto_curto' && <Input id={id} maxLength={300} value={(r as string) ?? ''} onChange={(e) => muda(p.id, e.target.value)} className="h-12 rounded-xl text-base" />}
                      {p.tipo === 'texto_longo' && <Textarea id={id} maxLength={2000} rows={4} value={(r as string) ?? ''} onChange={(e) => muda(p.id, e.target.value)} className="rounded-xl text-base" />}
                      {p.tipo === 'sim_nao' && (
                        <div className="flex gap-2" role="radiogroup" aria-labelledby={id}>
                          <span id={id} className="sr-only">{p.texto}</span>
                          {['Sim', 'Não'].map((o) => <Escolha key={o} papel="radio" ativo={r === o} onClick={() => muda(p.id, o)}>{o}</Escolha>)}
                        </div>
                      )}
                      {p.tipo === 'unica' && (
                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={id}>
                          <span id={id} className="sr-only">{p.texto}</span>
                          {p.opcoes.map((o) => <Escolha key={o} papel="radio" ativo={r === o} onClick={() => muda(p.id, o)}>{o}</Escolha>)}
                        </div>
                      )}
                      {p.tipo === 'multipla' && (
                        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
                          <span id={id} className="sr-only">{p.texto}</span>
                          {p.opcoes.map((o) => {
                            const lista = Array.isArray(r) ? r : [];
                            return <Escolha key={o} papel="checkbox" ativo={lista.includes(o)} onClick={() => muda(p.id, lista.includes(o) ? lista.filter((x) => x !== o) : [...lista, o])}>{o}</Escolha>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold" id="pg-origem">Como ficou sabendo da vaga? <span className="font-normal text-muted-foreground">(opcional)</span></span>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="pg-origem">
                    {ORIGENS.map((o) => <Escolha key={o} papel="radio" ativo={origem === o} onClick={() => setOrigem(origem === o ? null : o)}>{o}</Escolha>)}
                  </div>
                </div>
              </>
            )}

            {passo === 3 && (
              <>
                <h1 className="text-[26px] font-bold leading-tight sm:text-[30px]">Tudo certo para enviar?</h1>
                <div className="grid gap-2 rounded-2xl bg-muted/60 p-4">
                  <Linha rotulo="Vaga">{vaga.titulo}</Linha>
                  <Linha rotulo="Perfil">✓</Linha>
                  <Linha rotulo="Currículo">{perfil.curriculo_nome ? '✓' : 'Sem currículo'}</Linha>
                  {requisitos.length > 0 && <Linha rotulo="Requisitos">{marcados} de {requisitos.length}</Linha>}
                  {perguntas.length > 0 && <Linha rotulo="Perguntas">✓</Linha>}
                </div>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-400" /> Só o RH do processo vê. <Link to={ROTAS_DO_CANDIDATO.privacidade} target="_blank" className="font-semibold text-sky-700 underline dark:text-sky-400">Aviso de Privacidade</Link>
                </p>
              </>
            )}

            {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">{erro}</p>}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {passo > 0
                ? <Button type="button" variant="ghost" className="h-12 rounded-xl" onClick={() => { setErro(null); setPasso(passo - 1); }}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
                : <Button asChild variant="ghost" className="h-12 rounded-xl"><Link to={`/vagas/${slug}`}><ArrowLeft className="h-4 w-4" /> Vaga</Link></Button>}
              {passo < PASSOS.length - 1
                ? <Button type="button" disabled={passo === 0 && faltamNoPerfil.length > 0} onClick={avancar} className="h-12 flex-1 rounded-xl px-6 text-base sm:flex-none">Continuar <ArrowRight className="h-4 w-4" /></Button>
                : <Button type="button" disabled={enviando} onClick={enviar} className="h-12 flex-1 rounded-xl px-6 text-base sm:flex-none">{enviando ? 'Enviando…' : 'Enviar candidatura'}</Button>}
            </div>
          </div>
        )}
      </div>
    </MolduraDaConta>
  );
}
