import { useMemo, useRef, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { InstitutionalFooterBar } from '@/components/news/InstitutionalFooterBar';
import { JournalDecorationLayer } from './JournalDecorationLayer';
import { brandColorCount } from '@/lib/news/units';
import { rowSiblings } from '@/lib/journal/rows';
import { anaLogo } from '@/lib/anaLogo';
import {
  TEXT_STYLE_CLASSES,
  journalColor,
  type JournalBlock,
  type JournalPage,
} from '@/lib/journal/types';

export const A4_W = 794;
export const A4_H = 1123;

const SPAN_CLASS: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
};

const RATIO_CLASS: Record<string, string> = {
  '16/9': 'aspect-[16/9]',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  '3/4': 'aspect-[3/4]',
};

interface BlockViewProps {
  block: JournalBlock;
  selected?: boolean;
  interactive?: boolean;
  onSelect?: (id: string) => void;
  /** Grade da página — usada para converter arraste em colunas. */
  gridRef?: RefObject<HTMLDivElement>;
  /** Redimensionamento direto no canvas (colunas de 1 a 6). */
  onResizeSpan?: (id: string, span: number) => void;
  /** Altura fixa em px (ou undefined para automática). */
  onResizeHeight?: (id: string, height: number | undefined) => void;
  /** Reordenação por arraste: move o bloco arrastado para a posição do alvo. */
  onReorder?: (draggedId: string, targetId: string) => void;
  /** Ids dos outros blocos da mesma fileira — alvos do encaixe de altura. */
  siblingIds?: string[];
  /** Publica a linha-guia enquanto a altura casa com a de uma vizinha. */
  onAlignGuide?: (guide: AlignGuide | null) => void;
}

/** Linha-guia mostrada quando a base do bloco arrastado casa com a da vizinha. */
export interface AlignGuide {
  /** Distância do topo da área de blocos, em px de tela. */
  top: number;
  /** Altura que as duas passaram a compartilhar, em px do documento. */
  height: number;
}

/**
 * Tolerância do encaixe, em px de tela.
 *
 * Medida na tela e não no documento de propósito: é a distância que o dedo
 * percorre, e ela não deve mudar com o zoom do canvas.
 */
const ALIGN_SNAP_PX = 8;

export function JournalBlockView({
  block,
  selected,
  interactive,
  onSelect,
  gridRef,
  onResizeSpan,
  onResizeHeight,
  onReorder,
  siblingIds,
  onAlignGuide,
}: BlockViewProps) {
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);
  const canDrag = Boolean(interactive && onReorder);

  const wrapper = cn(
    'group/block relative',
    SPAN_CLASS[block.span] ?? 'col-span-6',
    interactive && 'cursor-pointer rounded-sm transition-[box-shadow]',
    interactive && !selected && 'hover:shadow-[0_0_0_1.5px_hsl(var(--ring))]',
    selected && 'shadow-[0_0_0_2px_hsl(var(--primary))]',
    block.height ? 'overflow-hidden' : undefined,
  );

  const handleClick = interactive ? () => onSelect?.(block.id) : undefined;

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const grid = gridRef?.current;
    const blockEl = (event.currentTarget as HTMLElement).parentElement;
    if (!grid || !blockEl || !onResizeSpan) return;

    onSelect?.(block.id);
    const startX = event.clientX;
    const startSpan = block.span;
    // Largura da coluna medida no próprio bloco (já considera zoom e gaps).
    const colWidth = blockEl.getBoundingClientRect().width / startSpan;
    if (colWidth <= 0) return;

    let lastSpan: number = startSpan;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = Math.max(1, Math.min(6, startSpan + Math.round(delta / colWidth)));
      if (next !== lastSpan) {
        lastSpan = next;
        onResizeSpan(block.id, next);
      }
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  /** Alça inferior — define altura fixa do bloco em px do canvas (compensa o zoom). */
  const startResizeHeight = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const blockEl = (event.currentTarget as HTMLElement).parentElement;
    if (!blockEl || !onResizeHeight) return;

    onSelect?.(block.id);
    const rect = blockEl.getBoundingClientRect();
    const startY = event.clientY;
    const startHeight = block.height ?? rect.height;
    // Escala aplicada ao canvas (zoom) — converte px de tela em px do documento.
    const scale = rect.height > 0 ? rect.height / blockEl.offsetHeight : 1;

    // Vizinhas medidas uma vez, no início: elas não mudam durante o arraste, e
    // remedir a cada quadro custaria um reflow por movimento do mouse.
    const grid = gridRef?.current;
    const alvos = (siblingIds ?? [])
      .map((id) => grid?.querySelector<HTMLElement>(`[data-block-id="${id}"]`))
      .filter((el): el is HTMLElement => Boolean(el))
      .map((el) => ({ el, altura: el.getBoundingClientRect().height / (scale || 1) }));

    let lastHeight = startHeight;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = (moveEvent.clientY - startY) / (scale || 1);
      let next = Math.max(24, Math.round(startHeight + delta));

      // O encaixe compara em px de tela para não ficar grudento com zoom alto.
      const casou = alvos.find(
        (alvo) => Math.abs(next - alvo.altura) * (scale || 1) <= ALIGN_SNAP_PX,
      );
      if (casou) next = Math.round(casou.altura);

      if (next !== lastHeight) {
        lastHeight = next;
        onResizeHeight(block.id, next);
      }

      if (onAlignGuide) {
        if (casou) {
          const area = grid?.parentElement;
          const base = casou.el.getBoundingClientRect().bottom;
          const origem = area?.getBoundingClientRect().top ?? 0;
          onAlignGuide({ top: base - origem, height: Math.round(casou.altura) });
        } else {
          onAlignGuide(null);
        }
      }
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      onAlignGuide?.(null);
    };
    document.body.style.cursor = 'row-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const resizeHandle =
    interactive && onResizeSpan ? (
      <div
        role="presentation"
        data-pdf-helper="true"
        onMouseDown={startResize}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'absolute -right-2 top-0 bottom-0 z-30 flex w-4 cursor-col-resize items-center justify-center',
          'opacity-0 transition-opacity group-hover/block:opacity-100',
          selected && 'opacity-100',
        )}
      >
        <div className="h-10 w-1.5 rounded-full bg-primary/70 shadow-sm transition-colors hover:bg-primary" />
      </div>
    ) : null;

  const heightHandle =
    interactive && onResizeHeight ? (
      <div
        role="presentation"
        data-pdf-helper="true"
        onMouseDown={startResizeHeight}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onResizeHeight(block.id, undefined);
        }}
        onClick={(event) => event.stopPropagation()}
        title="Arraste para ajustar a altura · clique duplo para altura automática"
        className={cn(
          'absolute -bottom-2 left-0 right-0 z-30 flex h-4 cursor-row-resize items-center justify-center',
          'opacity-0 transition-opacity group-hover/block:opacity-100',
          selected && 'opacity-100',
        )}
      >
        <div className="h-1.5 w-10 rounded-full bg-primary/70 shadow-sm transition-colors hover:bg-primary" />
      </div>
    ) : null;

  const dragHandle = canDrag ? (
    <div
      role="presentation"
      data-pdf-helper="true"
      draggable
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/journal-block', block.id);
        onSelect?.(block.id);
      }}
      onClick={(event) => event.stopPropagation()}
      title="Arraste para reordenar o bloco"
      className={cn(
        'absolute -left-2 top-0 bottom-0 z-30 flex w-4 cursor-grab items-center justify-center active:cursor-grabbing',
        'opacity-0 transition-opacity group-hover/block:opacity-100',
        selected && 'opacity-100',
      )}
    >
      <div className="h-10 w-1.5 rounded-full bg-primary/40 shadow-sm transition-colors hover:bg-primary" />
    </div>
  ) : null;

  const spanBadge =
    interactive && onResizeSpan ? (
      <span
        data-pdf-helper="true"
        className={cn(
          'pointer-events-none absolute -top-2 right-1 z-30 rounded bg-primary px-1 text-[9px] font-bold text-primary-foreground',
          'opacity-0 transition-opacity group-hover/block:opacity-100',
          selected && 'opacity-100',
        )}
      >
        {block.span}/6
      </span>
    ) : null;


  let content: React.ReactNode = null;

  if (block.kind === 'text') {
    const textClasses = cn(
      TEXT_STYLE_CLASSES[block.style],
      'whitespace-pre-wrap',
      block.align === 'center' && 'text-center',
      block.align === 'right' && 'text-right',
      block.align === 'left' && 'text-left',
      block.align === 'justify' && 'text-justify',
      block.bold && 'font-bold',
      block.italic && 'italic',
    );
    const textStyle = {
      color: journalColor(block.color),
      
      ...(block.lineHeight ? { lineHeight: block.lineHeight } : {}),
      ...(block.style === 'destaque'
        ? { borderLeftColor: block.color ? journalColor(block.color) : '#F5705B' }
        : {}),
    };
    const lines = block.content.split('\n').filter((line) => line.trim().length > 0);


    content = block.list ? (
      <ul className={cn(textClasses, 'list-disc pl-4')} style={textStyle}>
        {(lines.length ? lines : [' ']).map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    ) : (
      <p className={textClasses} style={textStyle}>
        {block.content || ' '}
      </p>
    );
  } else if (block.kind === 'image') {
    // Com altura definida pela alça inferior, a imagem preenche todo o espaço
    // disponível; sem altura, mantém a proporção padrão do bloco.
    const hasFixedHeight = Boolean(block.height);
    content = (
      <figure className={cn('m-0', hasFixedHeight && 'flex h-full flex-col')}>
        <div
          className={cn(
            'w-full overflow-hidden rounded-[15px] bg-[#E4E0D2]',
            hasFixedHeight ? 'min-h-0 flex-1' : RATIO_CLASS[block.ratio],
          )}
        >

          {block.url ? (
            // Enquadramento automático: a foto sempre preenche o quadro do modelo
            // preservando a proporção original (cover + center), recortando o excedente.
            <img
              src={block.url}
              alt={block.caption || 'Imagem do jornal'}
              className="h-full w-full rounded-[15px] object-cover object-center"
              style={{ objectFit: 'cover', objectPosition: 'center' }}
              crossOrigin="anonymous"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-[#8B8778]">
              Imagem
            </div>
          )}
        </div>
        {block.caption && (
          <figcaption
            className={cn(TEXT_STYLE_CLASSES.legenda, 'mt-1')}
            style={{ color: block.color ? journalColor(block.color) : '#5C5A50' }}
          >
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  } else if (block.kind === 'agenda') {
    content = (
      <ul className="divide-y divide-[#D9D4C4]">
        {block.items.map((item) => (
          <li key={item.id} className="flex gap-3 py-1.5">
            <span className="w-14 shrink-0 text-[14px] font-bold text-news-brand-1">{item.date}</span>
            <span className="flex-1 text-[14px] font-semibold text-[#1F211F]">{item.title}</span>
            <span className="w-12 text-right text-[14px] text-[#5C5A50]">{item.time}</span>
            <span className="w-32 text-right text-[14px] text-[#5C5A50]">{item.place}</span>
          </li>
        ))}
      </ul>
    );
  } else {
    content = (
      <div
        className="border-t-2 pt-2"
        style={{ borderTopColor: block.color ? journalColor(block.color) : '#FACC00' }}
      >
        <p
          className="text-[26px] font-extrabold leading-none"
          style={{ color: journalColor(block.color) }}
        >
          {block.value}
        </p>
        <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-[#5C5A50]">{block.label}</p>
      </div>
    );
  }

  return (
    <div
      className={wrapper}
      data-block-kind={block.kind}
      /* usado pelo encaixe de altura para achar as vizinhas de fileira */
      data-block-id={block.id}
      onClick={handleClick}
      style={block.height ? { height: block.height } : undefined}
      onDragOver={
        canDrag
          ? (event) => {
              if (!event.dataTransfer.types.includes('text/journal-block')) return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              setDropSide(event.clientX - rect.left < rect.width / 2 ? 'before' : 'after');
            }
          : undefined
      }
      onDragLeave={canDrag ? () => setDropSide(null) : undefined}
      onDrop={
        canDrag
          ? (event) => {
              const draggedId = event.dataTransfer.getData('text/journal-block');
              event.preventDefault();
              event.stopPropagation();
              setDropSide(null);
              if (draggedId && draggedId !== block.id) onReorder?.(draggedId, block.id);
            }
          : undefined
      }
    >
      {content}
      {dropSide && (
        <div
          data-pdf-helper="true"
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-0 bottom-0 z-40 w-1 rounded bg-primary',
            dropSide === 'before' ? '-left-1' : '-right-1',
          )}
        />
      )}
      {spanBadge}
      {dragHandle}
      {resizeHandle}
      {heightHandle}
    </div>
  );
}


interface JournalPageViewProps {
  page: JournalPage;
  index: number;
  total: number;
  edition: string;
  unitName: string;
  selectedBlockId?: string | null;
  interactive?: boolean;
  onSelectBlock?: (id: string) => void;
  onSelectPageArea?: () => void;
  /** Redimensionamento por arraste direto no canvas. */
  onResizeBlockSpan?: (id: string, span: number) => void;
  /** Altura fixa por arraste na alça inferior. */
  onResizeBlockHeight?: (id: string, height: number | undefined) => void;
  /** Reordenação de blocos por arraste. */
  onReorderBlocks?: (draggedId: string, targetId: string) => void;
  /** Exibe a grade de 6 colunas (somente quando o layout está destravado). */
  showGrid?: boolean;
  /** Cor de fundo da folha A4 (#F0EEE4 padrão institucional). */
  paperColor?: string;
  /** Define a faixa do rodapé pelo segmento da unidade. Ausente = padrão neutro. */
  unitId?: string | null;
  className?: string;
}

/**
 * Faixa do rodapé por segmento: Educação usa as três primeiras cores; Social
 * mantém as cinco. Sem unidade definida, as cinco — é o padrão neutro.
 *
 * A contagem vem de `brandColorCount`, a mesma que decide a paleta das Formas
 * ANA: rodapé e formas têm de falar a língua do mesmo segmento.
 */
const footerStripes = brandColorCount;

/** Página A4 completa — o mesmo componente é usado no canvas, no preview e no PDF. */
export function JournalPageView({
  page,
  index,
  total,
  edition,
  unitName,
  selectedBlockId,
  interactive,
  onSelectBlock,
  onSelectPageArea,
  onResizeBlockSpan,
  onResizeBlockHeight,
  onReorderBlocks,
  showGrid = true,
  paperColor,
  unitId,
  className,
}: JournalPageViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [alignGuide, setAlignGuide] = useState<AlignGuide | null>(null);
  // Uma passada só por render: o mapa de fileiras serve a todos os blocos.
  const siblings = useMemo(
    () => new Map(page.blocks.map((b) => [b.id, rowSiblings(page.blocks, b.id)])),
    [page.blocks],
  );

  return (
    <div
      className={cn('relative flex flex-col overflow-hidden bg-news-paper', className)}
      style={{ width: A4_W, height: A4_H, ...(paperColor ? { backgroundColor: paperColor } : {}) }}
      onClick={onSelectPageArea}
    >
      {/* Tudo acima da faixa institucional. A borda inferior deste container é
          o topo da faixa — é o que a camada decorativa usa como apoio. */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <JournalDecorationLayer decorations={page.decorations} />

        <div className="relative z-10 flex items-center justify-between px-12 pt-10">
          {/* Tamanho por atributo, SVG no tamanho desenhado, sem object-fit:
              ver o porque em `anaLogo`. O marcador serve a exportacao. */}
          <img
            {...anaLogo(36)}
            alt="ANA Brasil"
            data-ana-logo="true"
            draggable={false}
          />
          <div className="text-right">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#1F211F]">
              Jornal Institucional
            </p>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[#5C5A50]">
              {[unitName, edition].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="relative z-10 mx-12 mt-3 h-px bg-[#D9D4C4]" />

        <div className="relative flex-1">
          {interactive && showGrid && (
            <div
              data-pdf-helper="true"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 grid grid-cols-6 gap-x-4 px-12 py-6"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-full rounded-[2px] border border-dashed border-primary/25 bg-primary/[0.03]"
                />
              ))}
            </div>
          )}

          <div
            ref={gridRef}
            /* marca só o canvas editável: as miniaturas também renderizam
               blocos, e medir a folha errada daria alturas de outra escala */
            data-journal-canvas={interactive ? 'true' : undefined}
            className="relative z-10 grid h-full grid-cols-6 content-start gap-x-4 gap-y-3 overflow-hidden px-12 py-6"
            // Só no canvas: evita que clicar no conteúdo desmarque o bloco. Fora
            // dele a folha é só desenho — barrar o clique impediria a miniatura
            // inteira de ser clicável na trilha de páginas.
            onClick={interactive ? (event) => event.stopPropagation() : undefined}
          >
            {page.blocks.map((block) => (
              <JournalBlockView
                key={block.id}
                block={block}
                interactive={interactive}
                selected={selectedBlockId === block.id}
                onSelect={onSelectBlock}
                gridRef={gridRef}
                onResizeSpan={onResizeBlockSpan}
                onResizeHeight={onResizeBlockHeight}
                onReorder={onReorderBlocks}
                siblingIds={siblings.get(block.id)}
                onAlignGuide={interactive ? setAlignGuide : undefined}
              />
            ))}
          </div>

          {/* Vive fora da grade para atravessar as margens da folha, e some
              junto com o arraste. Nunca entra no PDF: `data-pdf-helper`. */}
          {interactive && alignGuide && (
            <div
              data-pdf-helper="true"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
              style={{ top: alignGuide.top }}
            >
              <div className="absolute inset-x-0 top-0 border-t-[1.5px] border-dashed border-primary" />
              <span className="-mt-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary-foreground shadow-sm">
                alinhado · {alignGuide.height}px
              </span>
            </div>
          )}
        </div>



        <div className="relative z-10 px-12 pb-1 text-right text-[9px] text-[#5C5A50]">
          {index + 1} / {total}
        </div>
      </div>

      <InstitutionalFooterBar className="w-full" stripes={footerStripes(unitId)} />
    </div>
  );
}
