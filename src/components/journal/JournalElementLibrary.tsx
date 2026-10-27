import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { JOURNAL_ELEMENTS, type JournalElementKey } from '@/lib/journal/elements';

interface Props {
  /** Aplica a forma escolhida nos quatro cantos. */
  onPick: (element: JournalElementKey) => void;
}

/**
 * Biblioteca das formas — a escolha é visual, não por nome.
 *
 * Uma escolha veste os quatro cantos: mesma silhueta, espelhada conforme o lado
 * e invertida em cima. Depois disso cada canto vira um item independente na
 * lista de conteúdo.
 */
export function JournalElementLibrary({ onPick }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          Forma ANA
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 rounded-[16px]">
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            Escolher forma
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Entra nos quatro cantos, em todas as páginas.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {JOURNAL_ELEMENTS.map((element) => (
            <button
              key={element.key}
              type="button"
              aria-label={element.label}
              onClick={() => {
                onPick(element.key);
                setOpen(false);
              }}
              className={cn(
                'rounded-[12px] border border-border p-2 transition-colors hover:border-[hsl(var(--sel,168_80%_27%))] hover:bg-muted/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <svg
                viewBox={element.viewBox}
                className="h-12 w-full"
                preserveAspectRatio="xMidYMax meet"
                aria-hidden="true"
              >
                {element.paths.map((d, index) => (
                  <path key={index} d={d} fill="currentColor" />
                ))}
              </svg>
              <p className="mt-1.5 text-[11px] font-medium">{element.label}</p>
            </button>
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Cantos de cima e de baixo, espelhadas automaticamente — em cima, de cabeça para baixo e
          menores, para não disputar com o cabeçalho. Valem para o jornal inteiro; a cor de cada
          canto é ajustada depois.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export default JournalElementLibrary;
