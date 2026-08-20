import { Trash2, Plus, X, AlignVerticalSpaceAround } from 'lucide-react';
import { TextBlockPanel } from '@/components/journal/TextBlockPanel';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageBlockField } from '@/components/news/ImageBlockField';
import { ColorSwatchPicker } from '@/components/journal/ColorSwatchPicker';
import { TEMPLATE_LABELS, TEXT_STYLE_LABELS } from '@/lib/journal/types';
import type {
  BlockSpan,
  JournalColorKey,
  JournalBlock,
  JournalPage,
  TextStyleKey,
} from '@/lib/journal/types';
import { uid } from '@/lib/journal/templates';

interface Props {
  page: JournalPage | undefined;
  block: JournalBlock | undefined;
  onChangeBlock: (patch: Partial<JournalBlock>) => void;
  onRemoveBlock: () => void;
  onClose?: () => void;
  /** Layout travado pelo modelo: só o conteúdo pode ser editado. */
  locked?: boolean;
  /** Iguala a altura de todos os blocos da fileira à do bloco selecionado. */
  onEqualizeRow?: () => void;
  /** Quantas outras peças dividem a fileira com este bloco. */
  rowSiblingCount?: number;
}

export function JournalPropertiesPanel({ page, block, onChangeBlock, onRemoveBlock, onClose, locked, onEqualizeRow, rowSiblingCount = 0 }: Props) {
  if (!block) {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-semibold text-foreground">Conteúdo da página</p>
        <p className="text-muted-foreground">
          Modelo: <strong>{page ? TEMPLATE_LABELS[page.template] : '—'}</strong>
        </p>
        <p className="text-muted-foreground">Blocos nesta página: {page?.blocks.length ?? 0}</p>
        <p className="text-xs text-muted-foreground">
          Clique em um bloco no canvas para editar seu conteúdo. Cabeçalho, rodapé e margens são
          fixos pela identidade institucional.
        </p>
      </div>
    );
  }

  const title =
    block.kind === 'text'
      ? 'Texto'
      : block.kind === 'image'
        ? 'Imagem'
        : block.kind === 'agenda'
          ? 'Agenda'
          : 'Indicador';

  return (
    <div className="space-y-4 text-sm">
      <div className="-mx-3 -mt-3 flex items-center justify-between rounded-t-lg bg-accent px-3 py-2.5">
        <p className="font-semibold text-accent-foreground">{title}</p>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Fechar painel">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {locked ? (
        <p className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">
          Layout travado pelo modelo: tamanho e posição são fixos. Edite apenas o conteúdo (textos e
          imagens). Para alterar a estrutura, destrave o layout na barra do canvas.
        </p>
      ) : (
        <p className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">
          Largura: <strong className="text-foreground">{block.span} de 6 colunas</strong> · Altura:{' '}
          <strong className="text-foreground">
            {block.height ? `${block.height}px` : 'automática'}
          </strong>
          . No canvas: arraste a alça direita para largura, a alça inferior para altura (clique duplo
          volta ao automático) e a alça esquerda para reordenar os blocos.
        </p>
      )}

      {/* Só faz sentido com companhia na fileira — sozinho não há a que igualar. */}
      {!locked && rowSiblingCount > 0 && onEqualizeRow && (
        <Button variant="outline" size="sm" onClick={onEqualizeRow} className="w-full gap-2">
          <AlignVerticalSpaceAround className="h-4 w-4" />
          Igualar alturas da fileira
        </Button>
      )}



      {block.kind === 'text' && <TextBlockPanel block={block} onChange={onChangeBlock} />}


      {block.kind === 'image' && (
        <div className="space-y-3">
          <section className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Imagem
            </Label>
            <ImageBlockField
              value={block.url}
              onChange={(url) => onChangeBlock({ url } as Partial<JournalBlock>)}
            />
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Legenda (opcional)
              </Label>
              <Input
                className="h-9 bg-background"
                placeholder="Descreva a imagem…"
                value={block.caption}
                onChange={(event) => onChangeBlock({ caption: event.target.value } as Partial<JournalBlock>)}
              />
            </div>
            <ColorSwatchPicker
              label="Cor da legenda"
              value={block.color}
              onChange={(color: JournalColorKey) => onChangeBlock({ color } as Partial<JournalBlock>)}
            />
          </section>
        </div>
      )}

      {block.kind === 'stat' && (
        <div className="space-y-3">
          <section className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Conteúdo
            </Label>
            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground">Número</span>
              <Input
                className="h-9 bg-background"
                placeholder="Ex.: 120"
                value={block.value}
                onChange={(event) => onChangeBlock({ value: event.target.value } as Partial<JournalBlock>)}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground">Descrição</span>
              <Input
                className="h-9 bg-background"
                placeholder="Ex.: crianças atendidas"
                value={block.label}
                onChange={(event) => onChangeBlock({ label: event.target.value } as Partial<JournalBlock>)}
              />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-muted/30 p-2.5">
            <ColorSwatchPicker
              label="Cor do número"
              value={block.color}
              onChange={(color: JournalColorKey) => onChangeBlock({ color } as Partial<JournalBlock>)}
            />
          </section>
        </div>
      )}

      {block.kind === 'agenda' && (
        <section className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
          <div className="flex items-baseline justify-between">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Agenda
            </Label>
            <span className="text-[10px] text-muted-foreground">
              {block.items.length} {block.items.length === 1 ? 'linha' : 'linhas'}
            </span>
          </div>

          {block.items.map((item, index) => (
            <div key={item.id} className="space-y-1.5 rounded-md border border-border bg-background p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Item {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  aria-label={`Remover item ${index + 1}`}
                  onClick={() =>
                    onChangeBlock({
                      items: block.items.filter((entry) => entry.id !== item.id),
                    } as Partial<JournalBlock>)
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex gap-1.5">
                <Input
                  className="h-8"
                  placeholder="Data"
                  value={item.date}
                  onChange={(event) => {
                    const items = [...block.items];
                    items[index] = { ...item, date: event.target.value };
                    onChangeBlock({ items } as Partial<JournalBlock>);
                  }}
                />
                <Input
                  className="h-8"
                  placeholder="Hora"
                  value={item.time}
                  onChange={(event) => {
                    const items = [...block.items];
                    items[index] = { ...item, time: event.target.value };
                    onChangeBlock({ items } as Partial<JournalBlock>);
                  }}
                />
              </div>
              <Input
                className="h-8"
                placeholder="Evento"
                value={item.title}
                onChange={(event) => {
                  const items = [...block.items];
                  items[index] = { ...item, title: event.target.value };
                  onChangeBlock({ items } as Partial<JournalBlock>);
                }}
              />
              <Input
                className="h-8"
                placeholder="Local"
                value={item.place}
                onChange={(event) => {
                  const items = [...block.items];
                  items[index] = { ...item, place: event.target.value };
                  onChangeBlock({ items } as Partial<JournalBlock>);
                }}
              />
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            className="w-full bg-background"
            onClick={() =>
              onChangeBlock({
                items: [...block.items, { id: uid(), date: '', title: '', time: '', place: '' }],
              } as Partial<JournalBlock>)
            }
          >
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar linha
          </Button>
        </section>
      )}


      {!locked && (
        <div className="border-t border-border pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemoveBlock}
            className="w-full justify-start px-1 text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Remover bloco
          </Button>
        </div>
      )}
    </div>
  );
}

export default JournalPropertiesPanel;
