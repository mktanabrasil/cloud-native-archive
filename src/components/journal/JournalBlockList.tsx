import {
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Hash,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  JOURNAL_COLOR_LABELS,
  TEXT_STYLE_LABELS,
  journalColor,
  type JournalBlock,
  type JournalDecoration,
} from '@/lib/journal/types';
import {
  JOURNAL_CORNER_LABELS,
  findJournalElement,
  type JournalCornerKey,
} from '@/lib/journal/elements';

interface Props {
  blocks: JournalBlock[];
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  /** Layout travado pelo modelo — esconde os controles de ordenação. */
  locked?: boolean;
  /** Formas da página. Entram na mesma lista, mas não são blocos: não reordenam. */
  decorations?: JournalDecoration[];
  selectedCorner?: JournalCornerKey | null;
  onSelectDecoration?: (corner: JournalCornerKey) => void;
  onRemoveDecoration?: (corner: JournalCornerKey) => void;
}

/** Tipo legível do bloco (linha principal da lista). */
function blockKindLabel(block: JournalBlock): string {
  switch (block.kind) {
    case 'text':
      return TEXT_STYLE_LABELS[block.style];
    case 'image':
      return 'Imagem';
    case 'stat':
      return 'Número';
    case 'agenda':
      return 'Agenda';
    default:
      return 'Bloco';
  }
}

/** Prévia curta do conteúdo (linha secundária). */
function blockPreview(block: JournalBlock): string {
  switch (block.kind) {
    case 'text':
      return block.content.trim().slice(0, 40) || 'Sem texto';
    case 'image':
      return block.caption?.trim() || (block.url ? 'Imagem enviada' : 'Sem imagem');
    case 'stat':
      return [block.value, block.label].filter(Boolean).join(' · ') || 'Sem dados';
    case 'agenda':
      return `${block.items.length} item(ns)`;
    default:
      return '';
  }
}

function BlockIcon({ block }: { block: JournalBlock }) {
  const className = 'h-3.5 w-3.5';
  if (block.kind === 'image') return <ImageIcon className={className} />;
  if (block.kind === 'stat') return <Hash className={className} />;
  if (block.kind === 'agenda') return <CalendarDays className={className} />;
  return <Type className={className} />;
}

export function JournalBlockList({
  blocks,
  selectedBlockId,
  onSelect,
  onMove,
  locked,
  decorations = [],
  selectedCorner = null,
  onSelectDecoration,
  onRemoveDecoration,
}: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Blocos da página
        </Label>
        <span className="text-[10px] text-muted-foreground">{blocks.length}</span>
      </div>

      {!blocks.length && !decorations.length ? (
        <p className="rounded-lg border border-dashed border-border px-2.5 py-4 text-center text-xs text-muted-foreground">
          Nenhum bloco nesta página ainda.
        </p>
      ) : (
        <ul className="space-y-1">
          {blocks.map((block, index) => {
            const selected = block.id === selectedBlockId;
            return (
              <li
                key={block.id}
                className={cn(
                  'group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors',
                  selected
                    ? 'border-primary bg-accent'
                    : 'border-border bg-background hover:bg-accent/50',
                )}
              >
                <span
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-md',
                    selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <BlockIcon block={block} />
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelect(block.id)}
                >
                  <p className="truncate text-xs font-medium text-foreground">
                    {blockKindLabel(block)}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">{blockPreview(block)}</p>
                </button>
                {!locked && (
                  <div className="flex shrink-0 flex-col opacity-60 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-6"
                      aria-label="Mover para cima"
                      disabled={index === 0}
                      onClick={() => onMove(block.id, -1)}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-6"
                      aria-label="Mover para baixo"
                      disabled={index === blocks.length - 1}
                      onClick={() => onMove(block.id, 1)}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}

          {decorations.length > 0 && (
            <li className="pt-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Formas do jornal
              </Label>
              <p className="text-[10px] text-muted-foreground">Aparecem em todas as páginas.</p>
            </li>
          )}

          {decorations.map((decoration) => {
            const selected = decoration.corner === selectedCorner;
            return (
              <li
                key={decoration.corner}
                className={cn(
                  'group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors',
                  selected
                    ? 'border-primary bg-accent'
                    : 'border-border bg-background hover:bg-accent/50',
                )}
              >
                <span
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-md',
                    selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelectDecoration?.(decoration.corner)}
                >
                  <p className="truncate text-xs font-medium text-foreground">
                    Forma · {JOURNAL_CORNER_LABELS[decoration.corner].toLowerCase()}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {findJournalElement(decoration.element).label} ·{' '}
                    {JOURNAL_COLOR_LABELS[decoration.color]}
                  </p>
                </button>
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: journalColor(decoration.color) }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-destructive opacity-60 transition-opacity group-hover:opacity-100"
                  aria-label={`Remover forma do ${JOURNAL_CORNER_LABELS[decoration.corner].toLowerCase()}`}
                  onClick={() => onRemoveDecoration?.(decoration.corner)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default JournalBlockList;
