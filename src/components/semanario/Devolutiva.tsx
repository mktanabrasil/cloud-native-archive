import { useEffect, useState } from 'react';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { avisarPorEmail, darDevolutiva, lerUm } from '@/lib/semanario/api';
import { LIMITES, diaComSemana, prazoDaDevolutiva, prazoDeEnvio, type Semanario } from '@/lib/semanario/regras';
import { Vidro, quando } from './pecas';

/**
 * A devolutiva da orientadora pedagógica (17/11/2026): um comentário só, que a
 * professora vê no app. Ela pode reescrever a devolutiva depois; apagar volta o
 * semanário para "aguardando" e devolve à professora o "desfazer envio". O
 * banco é quem confere que é a orientadora da unidade (gatilho
 * `semanarios_guarda`).
 */
/**
 * O que a orientadora escreveu e ainda não enviou, por semanário. Trocar de
 * professora na lista, de semana ou de página não apaga o rascunho (vale até
 * fechar a aba).
 */
const rascunhos = new Map<string, string>();

export function Devolutiva({ semanario, onSalvo }: { semanario: Semanario; onSalvo: (s: Semanario) => void }) {
  const [texto, setTextoLocal] = useState(rascunhos.get(semanario.id) ?? semanario.devolutiva ?? '');
  const setTexto = (t: string) => {
    setTextoLocal(t);
    if (t.trim() === (semanario.devolutiva ?? '').trim()) rascunhos.delete(semanario.id); else rascunhos.set(semanario.id, t);
  };
  const [salvando, setSalvando] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  // Trocou de semanário (na lista ao lado): o texto acompanha.
  useEffect(() => { setTextoLocal(rascunhos.get(semanario.id) ?? semanario.devolutiva ?? ''); }, [semanario.id, semanario.devolutiva]);

  if (semanario.status === 'preenchimento') {
    return (
      <Vidro className="p-4 text-[13.5px] text-muted-foreground">
        A devolutiva abre quando a professora enviar o semanário (o prazo dela é {diaComSemana(prazoDeEnvio(semanario.semana))}).
        {rascunhos.has(semanario.id) && ' O seu rascunho está guardado e volta quando ela enviar.'}
      </Vidro>
    );
  }

  const atual = (semanario.devolutiva ?? '').trim();
  const mudou = texto.trim() !== atual;
  const salvar = async (novo: string) => {
    setSalvando(true);
    try {
      const s = await darDevolutiva(semanario.id, novo);
      rascunhos.delete(semanario.id);
      onSalvo(s);
      toast.success(novo.trim() ? (atual ? 'Devolutiva atualizada' : 'Devolutiva enviada') : 'Devolutiva apagada', {
        description: novo.trim() ? 'A professora recebe um e-mail e vê a devolutiva no app.' : 'O semanário volta a aguardar a devolutiva.',
      });
      // O e-mail para a professora (apagar não avisa). Se não sair, ela vê no app.
      if (s.devolutiva) {
        void avisarPorEmail(s.id, 'devolutiva').catch(() =>
          toast.info('O e-mail para a professora não saiu', { description: 'A devolutiva está gravada; ela vê no app.' }));
      }
    } catch (e) {
      // Pode ser que a professora tenha desfeito o envio enquanto ela escrevia: relê e mostra.
      const agora = await lerUm(semanario.id).catch(() => null);
      if (agora && agora.status === 'preenchimento') {
        onSalvo(agora);
        toast.info('A professora desfez o envio', { description: 'Ela voltou a mexer no planejamento. O seu texto fica guardado aqui até ela enviar de novo.' });
      } else {
        if (agora) onSalvo(agora);
        toast.error('Não foi possível salvar a devolutiva', { description: (e as Error).message });
      }
    } finally { setSalvando(false); setConfirmarApagar(false); }
  };

  return (
    <Vidro className="p-4">
      <label htmlFor={`devolutiva-${semanario.id}`} className="text-[13px] font-semibold">Devolutiva</label>
      <p className="text-[12px] text-muted-foreground">
        {semanario.devolutiva_em
          ? `Enviada ${quando(semanario.devolutiva_em)}${semanario.devolutiva_por ? ` por ${semanario.devolutiva_por}` : ''}.`
          : `Até ${diaComSemana(prazoDaDevolutiva(semanario.semana))}.`}
      </p>
      <Textarea id={`devolutiva-${semanario.id}`} value={texto} maxLength={LIMITES.devolutiva} rows={4}
        placeholder="Escreva a devolutiva para a professora. Ela vê no app."
        onChange={e => setTexto(e.target.value)}
        className="mt-2 rounded-[12px] border-black/10 bg-white/80 text-[13.5px] leading-snug dark:border-white/10 dark:bg-white/5" />
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {atual && (
          <Button variant="ghost" size="sm" className="mr-auto gap-1.5 text-muted-foreground" disabled={salvando} onClick={() => setConfirmarApagar(true)}>
            <Trash2 className="h-4 w-4" /> Apagar a devolutiva
          </Button>
        )}
        <Button className="gap-1.5 rounded-full" disabled={salvando || !texto.trim() || !mudou} onClick={() => void salvar(texto)}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {atual ? 'Atualizar devolutiva' : 'Enviar devolutiva'}
        </Button>
      </div>

      <AlertDialog open={confirmarApagar} onOpenChange={o => !o && setConfirmarApagar(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a devolutiva?</AlertDialogTitle>
            <AlertDialogDescription>O semanário volta a aguardar a devolutiva, e a professora pode desfazer o envio e mudar o planejamento.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={salvando} onClick={e => { e.preventDefault(); void salvar(''); }}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Vidro>
  );
}
