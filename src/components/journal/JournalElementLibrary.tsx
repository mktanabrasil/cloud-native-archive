import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { JOURNAL_ELEMENTS, type JournalElementKey } from '@/lib/journal/elements';

interface Props {
  /** Aplica a forma escolhida nos dois cantos. */
  onPick: (element: JournalElementKey) => void;
}

/**
 * Biblioteca das formas — a escolha é visual, não por nome.
 *
 * Uma escolha aplica o par: mesma silhueta nos dois cantos inferiores,
 * espelhada conforme o lado. Depois disso cada lado vira um item independente
 * na lista de conteúdo.
 */
export function JournalElementLibrary({ onPick }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Forma ANA
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Escolher forma
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Entra nos dois cantos, em todas as páginas.
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
                'rounded-md border border-border p-2 transition-colors hover:border-primary hover:bg-accent',
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

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Canto esquerdo e canto direito, espelhadas automaticamente. Valem para o jornal inteiro; a
          cor de cada lado é ajustada depois.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export default JournalElementLibrary;
