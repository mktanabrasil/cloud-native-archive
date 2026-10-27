import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { dataEHora } from '@/lib/vagas/candidatura';
import {
  FORMATOS, diaPorExtenso, marcarLidas, mensagensDa, pendentesDoCandidato, responderMensagem, type Mensagem,
} from '@/lib/vagas/mensagens';

/**
 * As mensagens do RH na candidatura (passo 5, mockup de 19/10/2026). O que
 * pede ação vem no topo: o convite com "Confirmo presença / Não posso nesse
 * horário" e a pergunta com o campo de resposta. Embaixo, a conversa. Abrir
 * marca as mensagens da equipe como lidas.
 */

function Convite({ m, aoResponder }: { m: Mensagem; aoResponder: () => void }) {
  const [naoPosso, setNaoPosso] = useState(false);
  const [quando, setQuando] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const e = m.entrevista;
  async function responder(presenca: 'confirmada' | 'nao_pode') {
    setEnviando(true); setErro(null);
    try { await responderMensagem(m.id, presenca === 'nao_pode' ? quando : '', presenca); aoResponder(); }
    catch { setErro('Não deu para enviar. Tente de novo.'); }
    finally { setEnviando(false); }
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] border border-black/5 bg-card p-4 sm:p-5 dark:border-white/5" data-testid="convite">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-info"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Convite para entrevista</span>
      {e && (
        <p className="font-display text-[17px] font-semibold leading-snug">
          <span className="capitalize">{diaPorExtenso(e.dia)}</span> às {e.hora}<br />
          <span className="font-sans text-sm font-normal text-muted-foreground">{FORMATOS.find(([k]) => k === e.formato)?.[1]}{e.local ? ` · ${e.local}` : ''}</span>
        </p>
      )}
      <p className="whitespace-pre-line text-sm">{m.texto}</p>
      {naoPosso ? (
        <>
          <label className="grid gap-1 text-sm font-semibold">Que dias e horários você pode?
            <Textarea rows={2} maxLength={500} value={quando} onChange={(ev) => setQuando(ev.target.value)} className="font-normal" placeholder="Ex.: segunda ou terça à tarde" />
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setNaoPosso(false)}>Voltar</Button>
            <Button disabled={enviando || !quando.trim()} onClick={() => responder('nao_pode')}>Avisar o RH</Button>
          </div>
        </>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={enviando} onClick={() => responder('confirmada')} className="h-11"><Check className="h-4 w-4" /> Confirmo presença</Button>
          <Button disabled={enviando} variant="outline" className="h-11" onClick={() => setNaoPosso(true)}>Não posso nesse horário</Button>
        </div>
      )}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}

function Pergunta({ m, aoResponder }: { m: Mensagem; aoResponder: () => void }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function responder() {
    setEnviando(true); setErro(null);
    try { await responderMensagem(m.id, texto); aoResponder(); }
    catch { setErro('Não deu para enviar. Tente de novo.'); }
    finally { setEnviando(false); }
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] border border-black/5 bg-card p-4 sm:p-5 dark:border-white/5" data-testid="pergunta">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-warning"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Pergunta do RH</span>
      <p className="whitespace-pre-line text-sm">{m.texto}</p>
      <Textarea aria-label="Sua resposta" rows={3} maxLength={1000} value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder="Escreva sua resposta…" />
      <Button className="self-start" disabled={enviando || !texto.trim()} onClick={responder}>Enviar resposta</Button>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}

export function MensagensDoCandidato({ candidatura, retirada }: { candidatura: string; retirada: boolean }) {
  const [lista, setLista] = useState<Mensagem[] | null>(null);
  const carregar = () => mensagensDa(candidatura).then(setLista).catch(() => setLista([]));
  useEffect(() => {
    mensagensDa(candidatura).then((l) => {
      setLista(l);
      if (l.some((m) => m.autor === 'equipe' && !m.lida_em)) marcarLidas(candidatura).catch(() => null);
    }).catch(() => setLista([]));
  }, [candidatura]);

  if (!lista || lista.length === 0) return null;
  const pendentes = retirada ? [] : pendentesDoCandidato(lista);
  const idsPendentes = new Set(pendentes.map((m) => m.id));
  const historico = lista.filter((m) => !idsPendentes.has(m.id));

  return (
    <section aria-label="Mensagens do RH" className="flex flex-col gap-3">
      {pendentes.map((m) => m.tipo === 'convite'
        ? <Convite key={m.id} m={m} aoResponder={carregar} />
        : <Pergunta key={m.id} m={m} aoResponder={carregar} />)}
      {historico.length > 0 && (
        <>
          <h2 className="mt-1 text-[15px] font-semibold">Mensagens</h2>
          <ul className="flex flex-col gap-2">
            {historico.map((m) => (
              <li key={m.id} className={`grid gap-1 rounded-[16px] p-3.5 text-sm ${m.autor === 'candidato' ? 'ml-6 bg-muted/70' : 'border border-black/5 bg-card dark:border-white/5'}`}>
                <b className="text-xs font-semibold text-muted-foreground">
                  {m.autor === 'candidato' ? 'Você respondeu' : m.tipo === 'convite' ? `Convite · ${m.entrevista ? `${diaPorExtenso(m.entrevista.dia)} às ${m.entrevista.hora}` : ''}` : m.tipo === 'pergunta' ? 'Pergunta do RH' : 'Mensagem do RH'}
                </b>
                <span className="whitespace-pre-line">{m.texto}</span>
                <span className="text-[11px] text-muted-foreground">{dataEHora(m.created_at)}{m.presenca === 'confirmada' ? ' · presença confirmada' : m.presenca === 'nao_pode' ? ' · você pediu outro horário' : ''}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
