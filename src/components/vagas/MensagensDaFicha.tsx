import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
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
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Modelo">
          {MODELOS.filter(([k]) => k !== 'convite' || podeConvidar).map(([k, rot]) => (
            <Button key={k} type="button" size="sm" variant={tipo === k ? 'default' : 'secondary'} className="h-8 rounded-full" aria-pressed={tipo === k}
              onClick={() => { setTipo(k); setMexeu(false); }}>{rot}</Button>
          ))}
        </div>
        {tipo === 'convite' && (
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-semibold">Dia<Input type="date" value={e.dia} onChange={(ev) => setE({ ...e, dia: ev.target.value })} /></label>
              <label className="grid gap-1 text-xs font-semibold">Horário<Input type="time" value={e.hora} onChange={(ev) => setE({ ...e, hora: ev.target.value })} /></label>
              <label className="col-span-2 grid gap-1 text-xs font-semibold sm:col-span-1">Formato
                <select value={e.formato} onChange={(ev) => setE({ ...e, formato: ev.target.value as Formato })} className="h-10 rounded-md border border-input bg-background px-2 text-sm font-normal">
                  {FORMATOS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                </select>
              </label>
            </div>
            {e.formato !== 'telefone' && (
              <label className="grid gap-1 text-xs font-semibold">{e.formato === 'online' ? 'Link da chamada' : 'Local'}
                <Input value={e.local} maxLength={200} placeholder={e.formato === 'online' ? 'https://meet.google.com/…' : 'Ex.: Sede, Rua…'} onChange={(ev) => setE({ ...e, local: ev.target.value })} />
              </label>
            )}
          </div>
        )}
        <label className="grid gap-1 text-xs font-semibold">Texto {mexeu ? '' : <span className="font-normal text-muted-foreground">(já vem escrito, dá para mudar)</span>}
          <Textarea rows={6} maxLength={4000} value={texto} onChange={(ev) => { setTexto(ev.target.value); setMexeu(true); }} className="font-normal" />
        </label>
        {tipo === 'pergunta' && <p className="text-xs text-muted-foreground">O candidato responde pelo app; a resposta aparece aqui e em “Pede atenção”.</p>}
        {tipo === 'recado' && <p className="text-xs text-muted-foreground">Recado: o candidato lê, sem campo de resposta.</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button disabled={enviando || faltaData || !texto.trim()} onClick={enviar}>
            <Send className="h-4 w-4" /> {enviando ? 'Enviando…' : move ? 'Enviar e mover para Entrevista' : 'Enviar'}
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
      {lista.length === 0 && <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>}
      {lista.map((m) => m.autor === 'candidato' ? (
        <div key={m.id} className="grid gap-1 rounded-xl bg-emerald-50 p-3 text-sm dark:bg-emerald-950/40">
          <b>{nome.split(/\s+/)[0]} respondeu</b>
          <span className="whitespace-pre-line">{m.texto}</span>
          <span className="text-xs text-muted-foreground">{dataEHora(m.created_at)}</span>
        </div>
      ) : (
        <div key={m.id} className="grid gap-1 rounded-xl bg-muted/60 p-3 text-sm">
          <b>{ROTULO[m.tipo]}{m.entrevista ? ` · ${diaPorExtenso(m.entrevista.dia)} às ${m.entrevista.hora}` : ''}</b>
          <span className="whitespace-pre-line">{m.texto}</span>
          <span className="text-xs text-muted-foreground">Enviada por {m.por ?? 'RH'} · {dataEHora(m.created_at)}</span>
          <span className="flex flex-wrap gap-1.5">
            {m.presenca === 'confirmada' && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">Presença confirmada</span>}
            {m.presenca === 'nao_pode' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">Não pode nesse horário</span>}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.lida_em ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>{m.lida_em ? 'Lida' : 'Ainda não lida'}</span>
          </span>
        </div>
      ))}
      {aoNova && <Button className="self-end" onClick={aoNova}><Send className="h-4 w-4" /> Nova mensagem</Button>}
    </div>
  );
}
