import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, FileText, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { EtapasDaCandidatura } from '@/components/vagas/EtapasDaCandidatura';
import { MolduraDasVagas } from '@/components/vagas/PecasDasVagas';
import { ConversaDaFicha, EnviarMensagem } from '@/components/vagas/MensagensDaFicha';
import { marcarLidas, mensagensDa, type Mensagem } from '@/lib/vagas/mensagens';
import { registrarAcesso } from '@/lib/vagas/auditoria';
import { dataEHora, rotuloDaEtapa, type Etapa, type Resultado } from '@/lib/vagas/candidatura';
import { TURNOS, linkDoCurriculo, periodo } from '@/lib/vagas/perfil';
import {
  abrirCandidatura, buscarVagaDoRh, escolaridadeDe, experienciasDe, historico, iniciais, lerObservacoes, lugarDe, moverCandidatura, nomeDoCandidato,
  proximosPassos, salvarObservacoes, textoDoMovimento, umaCandidatura, type CandidaturaRh, type Movimento,
} from '@/lib/vagas/rh';

/**
 * /vagas/:slug/candidatos/:id — a ficha do candidato para o RH (PR 9,
 * mockup de 09/10/2026). À esquerda, o que a pessoa enviou (a cópia do
 * perfil, os requisitos marcados, as respostas); à direita, a etapa com
 * avançar/voltar/não seguir, o currículo, as observações internas e o
 * histórico. Abrir a ficha tira o "novo"; avançar avisa o candidato por e-mail.
 */

const txt = (v: unknown) => (typeof v === 'string' ? v : '');

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-border/70 pb-2.5 text-sm last:border-b-0 last:pb-0 sm:grid-cols-[140px_minmax(0,1fr)]"><span className="text-muted-foreground">{rotulo}</span><b className="font-medium">{children}</b></div>;
}

/**
 * O currículo aberto dentro da ficha (19/10/2026): PDF num quadro com
 * rolagem, foto como imagem; o endereço é temporário (5 min), pedido ao
 * abrir a aba. "Abrir em outra aba" e "Baixar" para quem prefere.
 */
function CurriculoNaFicha({ caminho, nome, candidatura }: { caminho: string | null; nome: string | null; candidatura: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    if (!caminho) return;
    // Abrir o currículo fica na auditoria (passo 6, 20/10/2026).
    linkDoCurriculo(caminho).then((u) => { setUrl(u); registrarAcesso('curriculo.aberto', { candidatura }); }).catch(() => setFalhou(true));
  }, [caminho, candidatura]);
  if (!caminho) return <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">Não enviou currículo.</p>;
  if (falhou) return <p role="alert" className="text-sm font-semibold text-destructive">Não consegui abrir o currículo. Recarregue a página.</p>;
  if (!url) return <p className="text-sm text-muted-foreground">Abrindo o currículo…</p>;
  const ePdf = /.pdf$/i.test(caminho);
  return (
    <div className="flex flex-col gap-2">
      {ePdf
        ? <iframe title={`Currículo: ${nome ?? 'arquivo'}`} src={url} className="h-[70vh] min-h-[420px] w-full rounded-[20px] border border-black/5 bg-card dark:border-white/5" />
        : <img src={url} alt={`Currículo: ${nome ?? 'foto'}`} className="max-h-[75vh] w-full rounded-[20px] border border-black/5 bg-card object-contain dark:border-white/5" />}
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground" title={nome ?? undefined}><FileText className="mr-1 inline h-3.5 w-3.5" />{nome ?? 'currículo'}</span>
        <span className="flex-1" />
        <Button asChild variant="outline" size="sm"><a href={url} target="_blank" rel="noopener noreferrer">Abrir em outra aba</a></Button>
        <Button asChild variant="outline" size="sm"><a href={url} download={nome ?? undefined}>Baixar</a></Button>
      </div>
    </div>
  );
}

export default function FichaDoCandidatoPage() {
  const { slug = '', id = '' } = useParams();
  const { user } = useAuth();
  const { isRh, loading, userName } = useUserRole();
  const [c, setC] = useState<CandidaturaRh | null | undefined>(undefined);
  const [obs, setObs] = useState('');
  const [obsSalva, setObsSalva] = useState<'salvo' | 'salvando' | null>(null);
  const [hist, setHist] = useState<Movimento[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [aba, setAba] = useState<'candidatura' | 'curriculo' | 'mensagens' | 'historico'>('candidatura');
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [escrevendo, setEscrevendo] = useState(false);
  const [tituloDaVaga, setTituloDaVaga] = useState('');
  const temporizador = useRef<number>();
  const nome = c ? nomeDoCandidato(c) : '';
  useTituloDaAba(`${nome || 'Candidato'} · Trabalhe Conosco`);

  const recarregar = async () => {
    const [x, h, ms] = await Promise.all([umaCandidatura(id), historico(id).catch(() => []), mensagensDa(id).catch(() => [])]);
    setC(x); setHist(h); setMsgs(ms);
  };

  useEffect(() => {
    // O responsável pelo processo também entra (passo 3): o banco só entrega a candidatura se for dele.
    if (!user) return;
    (async () => {
      try {
        await abrirCandidatura(id).catch(() => null);
        registrarAcesso('ficha.aberta', { candidatura: id });
        await recarregar();
        setObs(await lerObservacoes(id).catch(() => ''));
        buscarVagaDoRh(slug).then((v) => setTituloDaVaga(v?.titulo ?? '')).catch(() => null);
      } catch { setC(null); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id]);

  // Abrir a aba de mensagens marca as respostas do candidato como lidas.
  const naoLidas = msgs.filter((m) => m.autor === 'candidato' && !m.lida_em).length;
  useEffect(() => {
    if (aba !== 'mensagens' || !naoLidas) return;
    marcarLidas(id).then(() => setMsgs((l) => l.map((m) => (m.autor === 'candidato' && !m.lida_em ? { ...m, lida_em: new Date().toISOString() } : m)))).catch(() => null);
  }, [aba, naoLidas, id]);

  if (loading) return null;
  if (!isRh && c === null) {
    return (
      <MolduraDasVagas>
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
          <Lock className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
        </div>
      </MolduraDasVagas>
    );
  }

  async function mover(etapa: Etapa, resultado: Resultado | null) {
    if (!c) return;
    setOcupado(true);
    try {
      const r = await moverCandidatura(c.id, etapa, resultado);
      await recarregar();
      const rot = rotuloDaEtapa(etapa, resultado);
      if (r.avisou && r.falhouAviso) toast.warning(`Movido para ${rot}`, { description: 'O e-mail ao candidato não saiu. A etapa já aparece na Minha área dele.' });
      else toast.success(`Movido para ${rot}`, { description: r.avisou ? 'O candidato foi avisado por e-mail.' : undefined });
    } catch {
      toast.error('Não deu para mover. Tente de novo.');
    } finally { setOcupado(false); }
  }

  function mudarObs(t: string) {
    setObs(t); setObsSalva(null);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(async () => {
      setObsSalva('salvando');
      try { await salvarObservacoes(id, t, userName || user?.email || 'RH'); setObsSalva('salvo'); }
      catch { setObsSalva(null); toast.error('As observações não foram salvas.'); }
    }, 800);
  }

  const passos = c ? proximosPassos(c, isRh) : null;
  const disponibilidade = c && Array.isArray(c.perfil.disponibilidade) ? (c.perfil.disponibilidade as string[]).map((t) => TURNOS.find(([k]) => k === t)?.[1] ?? t).join(', ') : '';

  // Esboço V2: blocos sólidos com título de bloco (sem caixa alta), abas segmentadas e um botão forte (avançar).
  const bloco = 'flex flex-col gap-3 rounded-[20px] border border-black/5 bg-card p-5 dark:border-white/5';
  const tituloDoBloco = 'text-[15px] font-semibold';

  return (
    <MolduraDasVagas>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <Link to={`/vagas/${slug}/candidatos`} className="flex min-h-[32px] items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Candidatos da vaga</Link>
        {c === undefined ? <p className="text-muted-foreground">Abrindo…</p> : c === null ? <p className="text-muted-foreground">Candidatura não encontrada.</p> : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-5">
              <div className="flex items-center gap-3.5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-muted font-display text-lg font-bold text-foreground">{iniciais(nome)}</span>
                <div className="min-w-0">
                  <h1 className="text-[28px] font-bold leading-tight">{nome}</h1>
                  <p className="text-sm text-muted-foreground">Protocolo <span className="tabular-nums">{c.protocolo}</span> · enviada em {dataEHora(c.created_at)}</p>
                  <p className="break-words text-sm text-[hsl(var(--fraco,0_0%_45%))]">{txt(c.perfil.email)}{txt(c.perfil.whatsapp) ? ` · ${txt(c.perfil.whatsapp)}` : ''}</p>
                </div>
              </div>

              <div role="tablist" aria-label="Partes da ficha" className="inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-[14px] bg-muted p-1">
                {([['candidatura', 'Candidatura'], ['curriculo', 'Currículo'], ['mensagens', 'Mensagens'], ['historico', 'Histórico']] as const).map(([k, rot]) => (
                  <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
                    className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[10px] px-3.5 py-1.5 text-[13.5px] transition-colors ${aba === k ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`}>
                    {rot}{k === 'mensagens' && naoLidas > 0 && <span className="ml-1.5 font-semibold tabular-nums text-destructive" aria-label={`${naoLidas} não lidas`}>{naoLidas}</span>}
                  </button>
                ))}
              </div>

              {aba === 'curriculo' && <CurriculoNaFicha caminho={c.curriculo_caminho} nome={c.curriculo_nome} candidatura={c.id} />}

              {aba === 'mensagens' && <ConversaDaFicha lista={msgs} nome={nome} aoNova={c.retirada_em ? undefined : () => setEscrevendo(true)} />}

              {aba === 'historico' && (
                <div className={bloco}>
                  <ol className="flex flex-col text-sm" data-testid="historico">
                    {hist.map((m, k) => <li key={k} className="border-b border-border/70 py-2 text-muted-foreground first:pt-0 last:border-b-0 last:pb-0"><span className="tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">{dataEHora(m.em)}</span> · <span className="text-foreground">{textoDoMovimento(m)}</span></li>)}
                  </ol>
                </div>
              )}

              {aba === 'candidatura' && (<>
              <section className={bloco}>
                <h2 className={tituloDoBloco}>Perfil enviado</h2>
                {txt(c.perfil.nome_social) && <Linha rotulo="Nome completo">{txt(c.perfil.nome)}</Linha>}
                <Linha rotulo="Nascimento">{txt(c.perfil.nascimento) ? new Date(`${txt(c.perfil.nascimento)}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</Linha>
                <Linha rotulo="Cidade">{lugarDe(c) || '—'}</Linha>
                <Linha rotulo="Formação">{escolaridadeDe(c)}{txt(c.perfil.curso) ? ` · ${txt(c.perfil.curso)}` : ''}</Linha>
                {txt(c.perfil.cursos_livres) && <Linha rotulo="Cursos livres">{txt(c.perfil.cursos_livres)}</Linha>}
                <Linha rotulo="Experiência">
                  {experienciasDe(c).length === 0 ? 'Nenhuma' : (
                    <ul className="flex flex-col gap-1">{experienciasDe(c).map((e, i) => <li key={i}>{e.funcao} · {e.onde} · <span className="font-normal text-muted-foreground">{periodo(e)}</span></li>)}</ul>
                  )}
                </Linha>
                <Linha rotulo="Disponibilidade">{disponibilidade || '—'}</Linha>
                <Linha rotulo="Acessibilidade">{txt(c.perfil.acessibilidade) || <span className="font-normal text-muted-foreground">não informada</span>}</Linha>
              </section>

              {c.requisitos.length > 0 && (
                <section className={bloco}>
                  <h2 className={tituloDoBloco}>Requisitos que marcou</h2>
                  {c.requisitos.map((r) => (
                    <p key={r.texto} className={`flex items-center gap-2 text-sm ${r.atende ? '' : 'text-muted-foreground'}`}>
                      {r.atende ? <Check className="h-4 w-4 shrink-0 text-success" /> : <span className="grid h-4 w-4 shrink-0 place-items-center">○</span>}{r.texto}
                    </p>
                  ))}
                </section>
              )}

              <section className={bloco}>
                <h2 className={tituloDoBloco}>Respostas</h2>
                {c.respostas.length === 0 && !c.origem && <p className="text-sm text-muted-foreground">Nenhuma.</p>}
                {c.respostas.map((r) => (
                  <div key={r.pergunta_id} className="rounded-[14px] bg-muted/50 p-3.5 text-sm">
                    <b className="mb-0.5 block text-[13px] font-semibold text-muted-foreground">{r.texto}</b>
                    <span className="whitespace-pre-line">{Array.isArray(r.resposta) ? r.resposta.join(', ') : r.resposta}</span>
                  </div>
                ))}
                {c.origem && <div className="rounded-[14px] bg-muted/50 p-3.5 text-sm"><b className="mb-0.5 block text-[13px] font-semibold text-muted-foreground">Como ficou sabendo da vaga</b>{c.origem}</div>}
              </section>
              </>)}
            </div>

            <aside className="flex flex-col gap-3">
              <div className={bloco}>
                <h2 className={tituloDoBloco}>Etapa</h2>
                <EtapasDaCandidatura etapa={c.etapa} resultado={c.resultado} retirada={!!c.retirada_em} />
                {c.retirada_em ? (
                  <p className="text-sm text-muted-foreground">O candidato retirou a candidatura em {dataEHora(c.retirada_em)}.</p>
                ) : (
                  <>
                    {passos?.avancar && (
                      <Button disabled={ocupado} onClick={() => mover(passos.avancar!.etapa, passos.avancar!.resultado)}>
                        {passos.avancar.rotulo} <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Um embaixo do outro (19/10/2026): lado a lado estouravam a coluna. */}
                    <div className="grid gap-2">
                      {passos?.voltar && <Button variant="outline" size="sm" disabled={ocupado} onClick={() => mover(passos.voltar!.etapa, null)}><ArrowLeft className="h-4 w-4" /> {passos.voltar.rotulo}</Button>}
                      {passos?.podeRecusar && <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={ocupado} onClick={() => mover('resultado', 'nao_selecionado')}>Não seguir</Button>}
                    </div>
                    <p className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{isRh ? 'Avançar e “Não seguir” avisam o candidato por e-mail. Voltar não avisa.' : 'Você move até a Entrevista; o resultado fica com o RH. Avançar avisa o candidato por e-mail.'}</p>
                  </>
                )}
              </div>

              {!c.retirada_em && (
                <Button variant="outline" className="bg-card" onClick={() => setEscrevendo(true)}>Enviar mensagem</Button>
              )}

              <div className={bloco}>
                <div className="flex items-center justify-between gap-2"><h2 className={tituloDoBloco}>Observações do RH</h2><span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{obsSalva === 'salvando' ? 'Salvando…' : obsSalva === 'salvo' ? 'Salvo' : 'Só a equipe vê'}</span></div>
                <Textarea aria-label="Observações do RH" rows={4} maxLength={4000} value={obs} onChange={(e) => mudarObs(e.target.value)} placeholder="Ex.: ligar quinta à tarde." />
              </div>

            </aside>
            <EnviarMensagem aberto={escrevendo} aoFechar={() => setEscrevendo(false)} candidatura={c.id} nome={nome} vaga={tituloDaVaga || 'a vaga'} etapa={c.etapa}
              aoEnviar={() => { recarregar(); setAba('mensagens'); }} />
          </div>
        )}
      </div>
    </MolduraDasVagas>
  );
}
