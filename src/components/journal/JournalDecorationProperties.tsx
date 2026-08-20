import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { JOURNAL_CORNER_LABELS, findJournalElement } from '@/lib/journal/elements';
import type { JournalColorKey, JournalDecoration } from '@/lib/journal/types';

interface Props {
  decoration: JournalDecoration;
  onChangeColor: (color: JournalColorKey) => void;
  onRemove: () => void;
}

/**
 * Propriedades da forma selecionada. Só cor e remoção: tamanho, posição e
 * orientação são do modelo, e por isso não aparecem como controle.
 */
export function JournalDecorationProperties({ decoration, onChangeColor, onRemove }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div>
        <p className="text-xs font-semibold">
          Forma · {JOURNAL_CORNER_LABELS[decoration.corner].toLowerCase()}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {findJournalElement(decoration.element).label} · em todas as páginas do jornal
        </p>
      </div>

      <ColorSwatchPicker label="Cor da forma" value={decoration.color} onChange={onChangeColor} />

      <Button variant="outline" size="sm" className="w-full text-destructive" onClick={onRemove}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover forma
      </Button>
    </div>
  );
}

export default JournalDecorationProperties;
