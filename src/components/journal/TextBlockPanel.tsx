import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColorSwatchPicker } from '@/components/journal/ColorSwatchPicker';
import { cn } from '@/lib/utils';
import { useToque } from '@/hooks/useToque';
import { TEXT_STYLE_LABELS, TEXT_STYLE_DEFAULT_SIZES, SELECTABLE_TEXT_STYLES } from '@/lib/journal/types';
import type {
  JournalBlock,
  JournalTextBlock,
  TextStyleKey,
} from '@/lib/journal/types';


export interface TextBlockPanelProps {
  block: JournalTextBlock;
  onChange: (patch: Partial<JournalBlock>) => void;
}

const ALIGNMENTS = [
  { value: 'left', label: 'Esquerda', Icon: AlignLeft },
  { value: 'center', label: 'Centralizado', Icon: AlignCenter },
  { value: 'right', label: 'Direita', Icon: AlignRight },
  { value: 'justify', label: 'Justificado', Icon: AlignJustify },
] as const;



const PLACEHOLDERS: Record<TextStyleKey, string> = {
  titulo_capa: 'Escreva o título principal da capa…',
  titulo_materia: 'Escreva o título da matéria…',
  subtitulo: 'Escreva o subtítulo…',
  corpo: 'Escreva o texto da matéria…',
  destaque: 'Escreva a frase de destaque…',
  chamada: 'Escreva a chamada curta…',
  legenda: 'Escreva a legenda…',
};

/** Painel contextual de um bloco de texto: todos os controles visíveis. */
export function TextBlockPanel({ block, onChange }: TextBlockPanelProps) {
  const toque = useToque();
  const lineHeight = block.lineHeight ?? 1.5;
  const defaultSize = TEXT_STYLE_DEFAULT_SIZES[block.style];


  return (
    <div className="space-y-3">
      {/* Conteúdo */}
      <section className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Conteúdo
          </Label>
          <span className="text-[10px] text-muted-foreground">{block.content.length} caracteres</span>
        </div>
        <Textarea
          value={block.content}
          rows={6}
          placeholder={PLACEHOLDERS[block.style]}
          className="resize-y text-sm"
          onChange={(event) => onChange({ content: event.target.value } as Partial<JournalBlock>)}
        />
      </section>

      {/* Estilo: função + tamanho */}
      <section className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Estilo
        </Label>
        <Select
          value={block.style}
          onValueChange={(value) => {
            const nextStyle = value as TextStyleKey;
            // Ao trocar de função, descarta o tamanho personalizado para adotar o padrão da nova função.
            onChange({ style: nextStyle, fontSize: undefined } as Partial<JournalBlock>);
          }}
        >
          <SelectTrigger className="h-9 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(SELECTABLE_TEXT_STYLES.includes(block.style)
              ? SELECTABLE_TEXT_STYLES
              : [...SELECTABLE_TEXT_STYLES, block.style]
            ).map((value) => (
              <SelectItem key={value} value={value}>
                {TEXT_STYLE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-[11px] text-muted-foreground">
          Tamanho fixo pela identidade: <span className="font-semibold text-foreground tabular-nums">{defaultSize}px</span>
        </p>

      </section>

      {/* Alinhamento e formatação, em uma única barra visual */}
      <section className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Alinhamento e formatação
        </Label>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
            {ALIGNMENTS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={block.align === value}
                onClick={() => onChange({ align: value } as Partial<JournalBlock>)}
                className={cn(
                  'grid place-items-center rounded transition-colors',
                  toque ? 'h-11 w-11' : 'h-8 w-8',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  block.align === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
            {([
              { key: 'bold', label: 'Negrito', Icon: Bold },
              { key: 'italic', label: 'Itálico', Icon: Italic },
              { key: 'list', label: 'Lista', Icon: List },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={Boolean(block[key])}
                onClick={() => onChange({ [key]: !block[key] } as Partial<JournalBlock>)}
                className={cn(
                  'grid place-items-center rounded transition-colors',
                  toque ? 'h-11 w-11' : 'h-8 w-8',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  block[key]
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Cor e espaçamento */}
      <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-2.5">
        <ColorSwatchPicker
          label="Cor do texto"
          value={block.color}
          onChange={(color) => onChange({ color } as Partial<JournalBlock>)}
        />
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label className="text-[11px] text-muted-foreground">Espaçamento entre linhas</Label>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {lineHeight.toFixed(1).replace('.', ',')}
            </span>
          </div>
          <Slider
            value={[lineHeight]}
            min={1}
            max={2}
            step={0.1}
            onValueChange={([value]) => onChange({ lineHeight: value } as Partial<JournalBlock>)}
          />
        </div>
      </section>
    </div>
  );
}

export default TextBlockPanel;
