import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { JOURNAL_CORNER_LABELS, findJournalElement } from '@/lib/journal/elements';
import { brandColorCount, newsUnitSegment } from '@/lib/news/units';
import {
  JOURNAL_COLOR_HEX,
  JOURNAL_COLOR_LABELS,
  journalColorsForBrandCount,
  type JournalColorKey,
  type JournalDecoration,
} from '@/lib/journal/types';

interface Props {
  decoration: JournalDecoration;
  /** Define o segmento e, com ele, quais cores de marca são oferecidas. */
  unitId?: string | null;
  onChangeColor: (color: JournalColorKey) => void;
  onRemove: () => void;
}

const SEGMENT_LABELS: Record<string, string> = {
  educacao: 'Educação',
  social: 'Social',
};

/**
 * Propriedades da forma selecionada. Só cor e remoção: tamanho, posição e
 * orientação são do modelo, e por isso não aparecem como controle.
 *
 * A paleta segue o segmento da unidade, a mesma regra da faixa do rodapé.
 */
export function JournalDecorationProperties({
  decoration,
  unitId,
  onChangeColor,
  onRemove,
}: Props) {
  const disponiveis = journalColorsForBrandCount(brandColorCount(unitId));
  const foraDoSegmento = !disponiveis.includes(decoration.color);
  const segmento = SEGMENT_LABELS[newsUnitSegment(unitId) ?? ''];

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

      <ColorSwatchPicker
        label="Cor da forma"
        value={decoration.color}
        onChange={onChangeColor}
        colors={disponiveis}
      />

      {/*
        A cor gravada continua valendo — só deixa de ser oferecida. Sem este
        aviso a pessoa veria a forma de uma cor que não aparece na paleta e
        pensaria que a tela quebrou.
      */}
      {foraDoSegmento && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-100/60 px-2 py-1.5 text-[10px] leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <span
            aria-hidden="true"
            className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border border-border"
            style={{ backgroundColor: JOURNAL_COLOR_HEX[decoration.color] }}
          />
          <span>
            Esta forma está em {JOURNAL_COLOR_LABELS[decoration.color].toLowerCase()}, que não faz
            parte das cores{segmento ? ` do segmento ${segmento}` : ' desta unidade'}. A cor é
            mantida, mas não aparece mais na paleta.
          </span>
        </p>
      )}

      <Button variant="outline" size="sm" className="w-full text-destructive" onClick={onRemove}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover forma
      </Button>
    </div>
  );
}

export default JournalDecorationProperties;
