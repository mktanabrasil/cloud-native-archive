import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { JOURNAL_TUTORIAL } from '@/lib/journal/tutorial';

interface Props {
  open: boolean;
  /** Chamado ao concluir, pular ou fechar — os três valem como "já viu". */
  onClose: () => void;
}

/**
 * Passo a passo de primeiro acesso ao Jornal.
 *
 * Fechar, pular ou terminar têm o mesmo efeito de propósito: ninguém fica preso
 * num tutorial, e quem quiser rever tem o botão de ajuda. A alternativa —
 * insistir até chegar ao fim — só ensina a clicar rápido para escapar.
 */
export function JournalTutorial({ open, onClose }: Props) {
  const [i, setI] = useState(0);
  const passo = JOURNAL_TUTORIAL[i];
  const ultimo = i === JOURNAL_TUTORIAL.length - 1;

  // Recomeça do primeiro a cada abertura: quem reabre pelo botão de ajuda
  // espera o tutorial inteiro, não a tela onde parou da última vez.
  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold tabular-nums text-primary-foreground">
            {i + 1}
          </span>
          <DialogTitle className="text-[17px] font-bold leading-tight tracking-tight">
            {passo.titulo}
          </DialogTitle>
          <span className="ml-auto shrink-0 pt-1 text-[11px] tabular-nums text-muted-foreground">
            {i + 1} de {JOURNAL_TUTORIAL.length}
          </span>
        </div>

        <div className="px-5 pb-1 pt-3.5">
          <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
            {passo.corpo.map((paragrafo, n) => (
              <p key={n}>{paragrafo}</p>
            ))}
          </div>

          <div className="mt-4 flex min-h-[118px] items-center justify-center rounded-lg border border-border bg-muted/40 p-3.5">
            {passo.figura}
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">{passo.legenda}</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
          <div className="flex gap-1.5">
            {JOURNAL_TUTORIAL.map((entrada, n) => (
              <button
                key={entrada.titulo}
                type="button"
                aria-label={`Passo ${n + 1}: ${entrada.titulo}`}
                aria-current={n === i ? 'step' : false}
                onClick={() => setI(n)}
                className={cn(
                  'h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  n === i ? 'w-4 bg-foreground' : 'w-1.5 bg-border hover:bg-muted-foreground/50',
                )}
              />
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!ultimo && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Pular tutorial
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}>
              Voltar
            </Button>
            <Button size="sm" onClick={() => (ultimo ? onClose() : setI(i + 1))}>
              {ultimo ? 'Começar a usar' : 'Próximo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default JournalTutorial;
