import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, FileText, Lock, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { EtapasDaCandidatura } from '@/components/vagas/EtapasDaCandidatura';
import { MolduraDasVagas } from '@/components/vagas/PecasDasVagas';
import { dataEHora, rotuloDaEtapa, type Etapa, type Resultado } from '@/lib/vagas/candidatura';
import { TURNOS, linkDoCurriculo, periodo } from '@/lib/vagas/perfil';
import {
  abrirCandidatura, escolaridadeDe, experienciasDe, historico, iniciais, lerObservacoes, lugarDe, moverCandidatura, nomeDoCandidato,
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
  return <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 text-sm"><span className="text-muted-foreground">{rotulo}</span><b className="font-semibold">{children}</b></div>;
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
  const temporizador = useRef<number>();
  const nome = c ? nomeDoCandidato(c) : '';
  useTituloDaAba(`${nome || 'Candidato'} · Trabalhe Conosco`);

  const recarregar = async () => {
    const [x, h] = await Promise.all([umaCandidatura(id), historico(id).catch(() => [])]);
    setC(x); setHist(h);
  };

  useEffect(() => {
    if (!isRh) return;
    (async () => {
      try {
        await abrirCandidatura(id).catch(() => null);
        await recarregar();
        setObs(await lerObservacoes(id).catch(() => ''));
      } catch { setC(null); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRh, id]);

  if (loading) return null;
  if (!isRh) {
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

  async function abrirCurriculo() {
    if (!c?.curriculo_caminho) return;
    const aba = window.open('', '_blank');
    try { const url = await linkDoCurriculo(c.curriculo_caminho); if (aba) aba.location.href = url; else window.location.href = url; }
    catch { aba?.close(); toast.error('Não consegui abrir o currículo.'); }
  }

  const passos = c ? proximosPassos(c) : null;
  const disponibilidade = c && Array.isArray(c.perfil.disponibilidade) ? (c.perfil.disponibilidade as string[]).map((t) => TURNOS.find(([k]) => k === t)?.[1] ?? t).join(', ') : '';

  return (
    <MolduraDasVagas>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <Link to={`/vagas/${slug}/candidatos`} className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Candidatos da vaga</Link>
        {c === undefined ? <p className="text-muted-foreground">Abrindo…</p> : c === null ? <p className="text-muted-foreground">Candidatura não encontrada.</p> : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-5">
              <div className="flex items-center gap-3.5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-lg font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">{iniciais(nome)}</span>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold leading-tight">{nome}</h1>
                  <p className="text-sm text-muted-foreground">Protocolo {c.protocolo} · enviada em {dataEHora(c.created_at)}</p>
                  <p className="text-sm text-muted-foreground">{txt(c.perfil.email)}{txt(c.perfil.whatsapp) ? ` · ${txt(c.perfil.whatsapp)}` : ''}</p>
                </div>
              </div>

              <section className="flex flex-col gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Perfil enviado</h2>
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
                <section className="flex flex-col gap-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Requisitos que marcou</h2>
                  {c.requisitos.map((r) => (
                    <p key={r.texto} className={`flex items-center gap-2 text-sm ${r.atende ? '' : 'text-muted-foreground'}`}>
                      {r.atende ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <span className="grid h-4 w-4 place-items-center">○</span>}{r.texto}
                    </p>
                  ))}
                </section>
              )}

              <section className="flex flex-col gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Respostas</h2>
                {c.respostas.length === 0 && !c.origem && <p className="text-sm text-muted-foreground">Nenhuma.</p>}
                {c.respostas.map((r) => (
                  <div key={r.pergunta_id} className="rounded-xl bg-muted/60 p-3 text-sm">
                    <b className="block text-xs font-semibold text-muted-foreground">{r.texto}</b>
                    <span className="whitespace-pre-line">{Array.isArray(r.resposta) ? r.resposta.join(', ') : r.resposta}</span>
                  </div>
                ))}
                {c.origem && <div className="rounded-xl bg-muted/60 p-3 text-sm"><b className="block text-xs font-semibold text-muted-foreground">Como ficou sabendo da vaga</b>{c.origem}</div>}
              </section>
            </div>

            <aside className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4">
              <div className="flex flex-col gap-3 rounded-xl bg-background p-3.5">
                <b className="text-sm">Etapa</b>
                <EtapasDaCandidatura etapa={c.etapa} resultado={c.resultado} retirada={!!c.retirada_em} />
                {c.retirada_em ? (
                  <p className="text-sm text-muted-foreground">O candidato retirou a candidatura em {dataEHora(c.retirada_em)}.</p>
                ) : (
                  <>
                    {passos?.avancar && (
                      <Button disabled={ocupado} onClick={() => mover(passos.avancar!.etapa, passos.avancar!.resultado)} className="bg-[#81E2CF] text-[#1F2322] hover:bg-[#6fd6c1]">
                        {passos.avancar.rotulo} <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="flex gap-2">
                      {passos?.voltar && <Button variant="outline" size="sm" className="flex-1" disabled={ocupado} onClick={() => mover(passos.voltar!.etapa, null)}><ArrowLeft className="h-4 w-4" /> {passos.voltar.rotulo}</Button>}
                      {passos?.podeRecusar && <Button variant="outline" size="sm" className="flex-1 text-red-700 dark:text-red-400" disabled={ocupado} onClick={() => mover('resultado', 'nao_selecionado')}><X className="h-4 w-4" /> Não seguir</Button>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Avançar e “Não seguir” avisam o candidato por e-mail. Voltar não avisa.</p>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2 rounded-xl bg-background p-3.5">
                <b className="text-sm">Currículo</b>
                {c.curriculo_caminho ? (
                  <Button variant="outline" size="sm" onClick={abrirCurriculo}><FileText className="h-4 w-4" /> Abrir {c.curriculo_nome ?? 'currículo'}</Button>
                ) : <span className="text-sm text-muted-foreground">Não enviou currículo.</span>}
              </div>

              <div className="flex flex-col gap-2 rounded-xl bg-background p-3.5">
                <div className="flex items-center justify-between"><b className="text-sm">Observações do RH</b><span className="text-[11px] text-muted-foreground">{obsSalva === 'salvando' ? 'Salvando…' : obsSalva === 'salvo' ? 'Salvo' : 'Só a equipe vê'}</span></div>
                <Textarea aria-label="Observações do RH" rows={4} maxLength={4000} value={obs} onChange={(e) => mudarObs(e.target.value)} placeholder="Ex.: ligar quinta à tarde." />
              </div>

              <div className="flex flex-col gap-1.5 rounded-xl bg-background p-3.5">
                <b className="text-sm">Histórico</b>
                <ol className="flex flex-col gap-1 text-xs text-muted-foreground" data-testid="historico">
                  {hist.map((m, i) => <li key={i}><span className="tabular-nums">{dataEHora(m.em)}</span> · {textoDoMovimento(m)}</li>)}
                </ol>
              </div>
            </aside>
          </div>
        )}
      </div>
    </MolduraDasVagas>
  );
}
