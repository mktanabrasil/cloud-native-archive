import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { dataEHora } from '@/lib/vagas/candidatura';
import {
  FORMATOS, MODELOS, diaPorExtenso, enviarMensagem, textoDoModelo,
  type Entrevista, type Formato, type Mensagem, type TipoDaEquipe,
} from '@/lib/vagas/mensagens';

/**
 * Escrever ao candidato pela ficha (passo 5, mockup de 19/10/2026): três
 * modelos com o texto já escrito; o convite tem dia, horário, formato e
 * local e, se o candidato ainda não está em Entrevista, leva para lá (um
 * e-mail só). O e-mail leva o texto inteiro.
 */
export function EnviarMensagem({ aberto, aoFechar, candidatura, nome, vaga, etapa, aoEnviar }: {
  aberto: boolean; aoFechar: () => void; candidatura: string; nome: string; vaga: string; etapa: string; aoEnviar: () => void;
}) {
  const podeConvidar = etapa !== 'resultado';
  const [tipo, setTipo] = useState<TipoDaEquipe>(podeConvidar ? 'convite' : 'recado');
  const [e, setE] = useState<Entrevista>({ dia: '', hora: '', formato: 'presencial', local: '' });
  const [texto, setTexto] = useState('');
  const [mexeu, setMexeu] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Abrir de novo começa limpo.
  useEffect(() => {
    if (!aberto) return;
    setTipo(podeConvidar ? 'convite' : 'recado');
    setE({ dia: '', hora: '', formato: 'presencial', local: '' });
    setMexeu(false);
  }, [aberto, podeConvidar]);

  // Enquanto a pessoa não mexeu no texto, ele acompanha o modelo e os campos do convite.
  useEffect(() => { if (!mexeu) setTexto(textoDoModelo(tipo, nome, vaga, e)); }, [tipo, e, nome, vaga, mexeu]);

  const faltaData = tipo === 'convite' && (!e.dia || !e.hora);
  const move = tipo === 'convite' && etapa !== 'entrevista';

  async function enviar() {
    setEnviando(true);
    try {
      const r = await enviarMensagem(candidatura, tipo, texto, tipo === 'convite' ? e : undefined);
      if (r.falhouEmail) toast.warning('Mensagem guardada', { description: 'O e-mail não saiu, mas a mensagem já aparece na área do candidato.' });
      else toast.success(r.moveu ? 'Convite enviado e candidato movido para Entrevista' : 'Mensagem enviada', { description: 'O candidato recebe por e-mail e no app.' });
      aoEnviar();
      aoFechar();
    } catch {
      toast.error('Não deu para enviar. Tente de novo.');
    } finally { setEnviando(false); }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) aoFechar(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mensagem para {nome}</DialogTitle>
          <DialogDescription>O candidato recebe por e-mail (o texto inteiro) e no app.</DialogDescription>
        </DialogHeader>
        <div className="inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-[14px] bg-muted p-1" role="group" aria-label="Modelo">
          {MODELOS.filter(([k]) => k !== 'convite' || podeConvidar).map(([k, rot]) => (
            <button key={k} type="button" aria-pressed={tipo === k} onClick={() => { setTipo(k); setMexeu(false); }}
              className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors ${tipo === k ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`}>{rot}</button>
          ))}
        </div>
        {tipo === 'convite' && (
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="grid gap-1.5 text-[13px] font-semibold">Dia<Input type="date" value={e.dia} onChange={(ev) => setE({ ...e, dia: ev.target.value })} /></label>
              <label className="grid gap-1.5 text-[13px] font-semibold">Horário<Input type="time" value={e.hora} onChange={(ev) => setE({ ...e, hora: ev.target.value })} /></label>
              <label className="col-span-2 grid gap-1.5 text-[13px] font-semibold sm:col-span-1">Formato
                <select value={e.formato} onChange={(ev) => setE({ ...e, formato: ev.target.value as Formato })} className="h-10 rounded-[12px] border border-input bg-card px-2.5 text-sm font-normal">
                  {FORMATOS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                </select>
              </label>
            </div>
            {e.formato !== 'telefone' && (
              <label className="grid gap-1.5 text-[13px] font-semibold">{e.formato === 'online' ? 'Link da chamada' : 'Local'}
                <Input value={e.local} maxLength={200} placeholder={e.formato === 'online' ? 'https://meet.google.com/…' : 'Ex.: Sede, Rua…'} onChange={(ev) => setE({ ...e, local: ev.target.value })} />
              </label>
            )}
          </div>
        )}
        <label className="grid gap-1.5 text-[13px] font-semibold">Texto {mexeu ? '' : <span className="font-normal text-muted-foreground">(já vem escrito, dá para mudar)</span>}
          <Textarea rows={6} maxLength={4000} value={texto} onChange={(ev) => { setTexto(ev.target.value); setMexeu(true); }} className="font-normal" />
        </label>
        {tipo === 'pergunta' && <p className="text-xs text-muted-foreground">O candidato responde pelo app; a resposta aparece aqui e em “Pede atenção”.</p>}
        {tipo === 'recado' && <p className="text-xs text-muted-foreground">Recado: o candidato lê, sem campo de resposta.</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button disabled={enviando || faltaData || !texto.trim()} onClick={enviar}>
            {enviando ? 'Enviando…' : move ? 'Enviar e mover para Entrevista' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROTULO: Record<string, string> = { convite: 'Convite para entrevista', pergunta: 'Pedir informação', recado: 'Mensagem' };

/** A conversa na aba "Mensagens" da ficha: o que a equipe enviou, se foi lido, a presença e as respostas. */
export function ConversaDaFicha({ lista, nome, aoNova }: { lista: Mensagem[]; nome: string; aoNova?: () => void }) {
  return (
    <div className="flex flex-col gap-2.5" data-testid="mensagens">
      {lista.length === 0 && <p className="rounded-[16px] border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>}
      {lista.map((m) => m.autor === 'candidato' ? (
        <div key={m.id} className="grid gap-1 rounded-[16px] bg-[hsl(var(--ativo))] p-3.5 text-sm sm:mr-10">
          <b className="font-semibold">{nome.split(/\s+/)[0]} respondeu</b>
          <span className="whitespace-pre-line">{m.texto}</span>
          <span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{dataEHora(m.created_at)}</span>
        </div>
      ) : (
        <div key={m.id} className="grid gap-1 rounded-[16px] border border-border bg-card p-3.5 text-sm sm:ml-10">
          <b className="font-semibold">{ROTULO[m.tipo]}{m.entrevista ? ` · ${diaPorExtenso(m.entrevista.dia)} às ${m.entrevista.hora}` : ''}</b>
          <span className="whitespace-pre-line">{m.texto}</span>
          <span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">Enviada por {m.por ?? 'RH'} · {dataEHora(m.created_at)}</span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
            {m.presenca === 'confirmada' && <span className="inline-flex items-center gap-1.5 text-info"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Presença confirmada</span>}
            {m.presenca === 'nao_pode' && <span className="inline-flex items-center gap-1.5 text-warning"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Não pode nesse horário</span>}
            <span className={`inline-flex items-center gap-1.5 ${m.lida_em ? 'text-success' : 'text-muted-foreground'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{m.lida_em ? 'Lida' : 'Ainda não lida'}</span>
          </span>
        </div>
      ))}
      {aoNova && <Button variant="outline" className="self-end" onClick={aoNova}>Nova mensagem</Button>}
    </div>
  );
}
