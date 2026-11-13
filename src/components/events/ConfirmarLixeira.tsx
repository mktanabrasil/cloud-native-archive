import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { tituloEmTexto } from '@/lib/events/titulo';
import type { AppEvent } from '@/types';

/**
 * "Mover para a lixeira?" antes de mover. Era só do Calendário; a Visão Geral
 * movia no primeiro toque (13/11/2026), e a gestora não vê a aba Lixeira para
 * desfazer. Depois do lançamento, mover um confirmado manda o e-mail de
 * cancelamento.
 */
export function ConfirmarLixeira({ eventos, isAdmin, onConfirmar, onCancelar }: {
  eventos: AppEvent[] | null;
  isAdmin: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const n = eventos?.length ?? 0;
  const algumConfirmado = (eventos ?? []).some(e => e.status === 'confirmado');
  return (
    <AlertDialog open={!!eventos} onOpenChange={(open) => !open && onCancelar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {n === 1 ? `Mover "${tituloEmTexto(eventos![0].title)}" para a lixeira?` : `Mover ${n} eventos para a lixeira?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {n === 1 ? 'Ele sai' : 'Eles saem'} da programação e do calendário. {isAdmin ? 'Dá para restaurar depois, na aba Lixeira.' : 'Se precisar de volta, peça à administração geral, que pode restaurar.'}
            {algumConfirmado && ' Quem recebe os avisos de evento recebe o e-mail de cancelamento.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {n === 1 ? 'Mover para a lixeira' : `Mover ${n} para a lixeira`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
