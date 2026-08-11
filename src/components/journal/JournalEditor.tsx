import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Type,
  Hash,
  Check,
  Lock,
  Unlock,
  Undo2,
  Redo2,
  Maximize2,
  Settings2,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { A4_H, A4_W, JournalPageView } from './JournalPageView';
import { JournalPropertiesPanel } from './JournalPropertiesPanel';
import { JournalBlockList } from './JournalBlockList';

import {
  DEFAULT_JOURNAL_PAPER,
  JOURNAL_PAPER_KEYS,
  JOURNAL_PAPER_LABELS,
  TEMPLATE_LABELS,
  journalPaper,
  type BlockSpan,
  type JournalBlock,
  type JournalPage,
  type JournalPaperKey,
  type JournalRecord,
  type JournalTemplate,
} from '@/lib/journal/types';
import {
  TEMPLATE_OPTIONS,
  createPage,
  imageBlock,
  statBlock,
  textBlock,
  uid,
} from '@/lib/journal/templates';
import { newsUnitName, profileUnitForNewsUnit } from '@/lib/news/units';
import { UnitBadge } from './UnitBadge';

interface Props {
  journal: JournalRecord;
  saving: boolean;
  savedAt: string | null;
  onBack: () => void;
  onSave: (
    id: string,
    draft: {
      name?: string;
      pages?: JournalPage[];
      status?: JournalRecord['status'];
      unitId?: string | null;
      profileUnit?: string | null;
    },
  ) => Promise<boolean>;
}

/** Largura da miniatura na barra lateral; a altura decorre da proporção A4. */
const THUMB_W = 180;
const THUMB_SCALE = THUMB_W / A4_W;

/** Estado de preenchimento da página — usado nos selos das miniaturas. */
function pageStatus(page: JournalPage): 'completa' | 'pendente' {
  const pending = page.blocks.some((block) => {
    if (block.kind === 'text') return block.content.trim().length === 0;
    if (block.kind === 'image') return !block.url;
    return false;
  });
  return pending ? 'pendente' : 'completa';
}

export function JournalEditor({ journal, saving, savedAt, onBack, onSave }: Props) {
  const [name, setName] = useState(journal.name);
  const [pages, setPages] = useState<JournalPage[]>(journal.pages?.length ? journal.pages : [createPage('capa')]);
  const [activePageId, setActivePageId] = useState<string>(pages[0].id);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.7);
  /** Layout do modelo travado: só o conteúdo é editável (padrão). */
  const [layoutLocked, setLayoutLocked] = useState(true);
  /** Modo de ajuste da folha: tela, largura, altura ou zoom manual (null). */
  const [fitMode, setFitMode] = useState<'screen' | 'width' | 'height' | null>('screen');
  /** Fundo da folha — vale para canvas, miniatura, preview e PDF. */
  const [paper, setPaper] = useState<JournalPaperKey>(DEFAULT_JOURNAL_PAPER);
  const paperColor = journalPaper(paper);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  /** Histórico de desfazer/refazer das páginas (limite de 50 passos). */
  const pagesRef = useRef<JournalPage[]>(pages);
  const undoStack = useRef<JournalPage[][]>([]);
  const redoStack = useRef<JournalPage[][]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];
  const selectedBlock = activePage?.blocks.find((block) => block.id === selectedBlockId);
  const unitName = useMemo(() => newsUnitName(journal.unit_id), [journal.unit_id]);

  /** Ajuste automático da folha à área central (recalcula ao redimensionar). */
  useEffect(() => {
    if (!fitMode) return;
    const element = canvasRef.current;
    if (!element) return;
    const recompute = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const byWidth = (width - 48) / A4_W;
      const byHeight = (height - 48) / A4_H;
      const next =
        fitMode === 'width' ? byWidth : fitMode === 'height' ? byHeight : Math.min(byWidth, byHeight);
      setZoom(Math.max(0.3, Math.min(1.5, Number(next.toFixed(3)))));
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitMode]);

  // Autosave com 2s de inatividade.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      onSave(journal.id, { name, pages });
      dirtyRef.current = false;
    }, 2000);
    return () => clearTimeout(timer);
  }, [name, pages, journal.id, onSave]);

  const setManualZoom = useCallback((updater: (current: number) => number) => {
    setFitMode(null);
    setZoom((current) => Math.max(0.3, Math.min(1.5, updater(current))));
  }, []);


  const mutatePages = useCallback((updater: (prev: JournalPage[]) => JournalPage[]) => {
    dirtyRef.current = true;
    undoStack.current = [...undoStack.current.slice(-49), pagesRef.current];
    redoStack.current = [];
    setHistoryTick((t) => t + 1);
    setPages(updater);
  }, []);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current = [...redoStack.current.slice(-49), pagesRef.current];
    dirtyRef.current = true;
    setPages(previous);
    setSelectedBlockId(null);
    setHistoryTick((t) => t + 1);
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current = [...undoStack.current.slice(-49), pagesRef.current];
    dirtyRef.current = true;
    setPages(next);
    setSelectedBlockId(null);
    setHistoryTick((t) => t + 1);
  }, []);

  // Atalhos de teclado: Ctrl/Cmd+Z desfaz, Ctrl/Cmd+Shift+Z (ou Ctrl+Y) refaz.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const canUndo = historyTick >= 0 && undoStack.current.length > 0;
  const canRedo = historyTick >= 0 && redoStack.current.length > 0;


  const updateBlock = (patch: Partial<JournalBlock>) => {
    if (!selectedBlockId) return;
    mutatePages((prev) =>
      prev.map((page) =>
        page.id !== activePage.id
          ? page
          : {
              ...page,
              blocks: page.blocks.map((block) =>
                block.id === selectedBlockId ? ({ ...block, ...patch } as JournalBlock) : block,
              ),
            },
      ),
    );
  };

  /** Redimensionamento por arraste no canvas — altera apenas a largura em colunas. */
  const resizeBlockSpan = useCallback(
    (blockId: string, span: number) => {
      const clamped = Math.max(1, Math.min(6, Math.round(span))) as BlockSpan;
      mutatePages((prev) =>
        prev.map((page) =>
          page.id !== activePage.id
            ? page
            : {
                ...page,
                blocks: page.blocks.map((block) =>
                  block.id === blockId ? ({ ...block, span: clamped } as JournalBlock) : block,
                ),
              },
        ),
      );
    },
    [activePage.id, mutatePages],
  );

  /** Alça inferior — altura fixa em px (undefined volta para automática). */
  const resizeBlockHeight = useCallback(
    (blockId: string, height: number | undefined) => {
      mutatePages((prev) =>
        prev.map((page) =>
          page.id !== activePage.id
            ? page
            : {
                ...page,
                blocks: page.blocks.map((block) =>
                  block.id === blockId ? ({ ...block, height } as JournalBlock) : block,
                ),
              },
        ),
      );
    },
    [activePage.id, mutatePages],
  );

  /** Reordenação por arraste — move o bloco arrastado para a posição do alvo. */
  const reorderBlocks = useCallback(
    (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return;
      mutatePages((prev) =>
        prev.map((page) => {
          if (page.id !== activePage.id) return page;
          const from = page.blocks.findIndex((block) => block.id === draggedId);
          const to = page.blocks.findIndex((block) => block.id === targetId);
          if (from < 0 || to < 0) return page;
          const blocks = [...page.blocks];
          const [moved] = blocks.splice(from, 1);
          blocks.splice(to, 0, moved);
          return { ...page, blocks };
        }),
      );
    },
    [activePage.id, mutatePages],
  );

  const removeBlock = () => {
    if (!selectedBlockId) return;
    mutatePages((prev) =>
      prev.map((page) =>
        page.id !== activePage.id
          ? page
          : { ...page, blocks: page.blocks.filter((block) => block.id !== selectedBlockId) },
      ),
    );
    setSelectedBlockId(null);
  };

  /** Move um bloco uma posição para cima/baixo na ordem da página. */
  const moveBlock = (blockId: string, direction: -1 | 1) => {
    mutatePages((prev) =>
      prev.map((page) => {
        if (page.id !== activePage.id) return page;
        const index = page.blocks.findIndex((block) => block.id === blockId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= page.blocks.length) return page;
        const blocks = [...page.blocks];
        [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
        return { ...page, blocks };
      }),
    );
  };

  /** Insere logo após o bloco selecionado (ou no fim, se nada estiver selecionado). */
  const addBlock = (block: JournalBlock) => {
    mutatePages((prev) =>
      prev.map((page) => {
        if (page.id !== activePage.id) return page;
        const at = page.blocks.findIndex((entry) => entry.id === selectedBlockId);
        const blocks = [...page.blocks];
        blocks.splice(at < 0 ? blocks.length : at + 1, 0, block);
        return { ...page, blocks };
      }),
    );
    setSelectedBlockId(block.id);
  };


  const addPage = (template: JournalTemplate) => {
    const page = createPage(template);
    mutatePages((prev) => [...prev, page]);
    setActivePageId(page.id);
    setSelectedBlockId(null);
  };

  const duplicatePage = (page: JournalPage) => {
    const copy: JournalPage = {
      ...page,
      id: uid(),
      blocks: page.blocks.map((block) => ({ ...block, id: uid() })),
    };
    mutatePages((prev) => {
      const index = prev.findIndex((entry) => entry.id === page.id);
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const removePage = (pageId: string) => {
    if (pages.length === 1) {
      toast.error('O jornal precisa de ao menos uma página.');
      return;
    }
    mutatePages((prev) => prev.filter((page) => page.id !== pageId));
    if (activePageId === pageId) setActivePageId(pages.find((page) => page.id !== pageId)!.id);
  };

  const movePage = (pageId: string, direction: -1 | 1) => {
    mutatePages((prev) => {
      const index = prev.findIndex((page) => page.id === pageId);
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const exportPdf = async (quality: 'digital' | 'impressao') => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const scale = quality === 'impressao' ? 3 : 1.6;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const nodes = Array.from(exportRef.current.querySelectorAll<HTMLElement>('[data-journal-page]'));

      for (let index = 0; index < nodes.length; index += 1) {
        const canvas = await html2canvas(nodes[index], {
          scale,
          useCORS: true,
          backgroundColor: paperColor,
          width: A4_W,
          height: A4_H,
          windowWidth: A4_W,
          windowHeight: A4_H,
          onclone: (doc) => {
            // html2canvas colapsa parte do espaçamento vertical do grid; reforçamos
            // o respiro acima das imagens para o PDF ficar igual ao preview.
            doc.querySelectorAll<HTMLElement>('[data-block-kind="image"]').forEach((el) => {
              el.style.paddingTop = '8px';
            });
            // html2canvas não suporta `object-fit`: ele estica a foto até o box,
            // deformando-a. Trocamos cada <img> por um bloco com background-size
            // cover/center, que reproduz exatamente o enquadramento do preview.
            doc.querySelectorAll<HTMLImageElement>('[data-block-kind="image"] img').forEach((img) => {
              const src = img.currentSrc || img.src;
              if (!src) return;
              const rect = img.getBoundingClientRect();
              const replacement = doc.createElement('div');
              replacement.className = img.className;
              replacement.style.cssText = img.style.cssText;
              replacement.style.width = '100%';
              replacement.style.height = rect.height > 0 ? `${rect.height}px` : '100%';
              replacement.style.backgroundImage = `url("${src}")`;
              replacement.style.backgroundSize = 'cover';
              replacement.style.backgroundPosition = 'center';
              replacement.style.backgroundRepeat = 'no-repeat';
              replacement.style.borderRadius = '15px';
              img.replaceWith(replacement);
            });
          },
        });
        if (index > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', quality === 'impressao' ? 0.98 : 0.9), 'JPEG', 0, 0, 210, 297);
      }

      pdf.save(`${name || 'jornal'}.pdf`);
      toast.success('PDF gerado.');
    } catch (error) {
      toast.error('Não foi possível gerar o PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-col gap-2 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
          <Input
            value={name}
            onChange={(event) => {
              dirtyRef.current = true;
              setName(event.target.value);
            }}
            className="h-9 w-56 text-base font-semibold"
          />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <Check className="h-3 w-3" /> {savedAt ? `Tudo salvo · ${savedAt}` : 'Tudo salvo'}
              </>
            )}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" onClick={() => exportPdf('impressao')} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Baixar PDF
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Mais opções de exportação">
                  ⋯
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Exportar
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => exportPdf('impressao')}
                  disabled={exporting}
                >
                  <Download className="mr-1.5 h-4 w-4" /> PDF impressão (alta)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => exportPdf('digital')}
                  disabled={exporting}
                >
                  <FileText className="mr-1.5 h-4 w-4" /> PDF digital (leve)
                </Button>
              </PopoverContent>
            </Popover>
          </div>

        </div>

        <UnitBadge
          variant="line"
          unitId={journal.unit_id}
          label="Jornal da unidade"
          onChangeUnit={(unitId) =>
            onSave(journal.id, { unitId, profileUnit: profileUnitForNewsUnit(unitId) })
          }
        />
      </div>



      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[210px_1fr_300px]">
        {/* Miniaturas */}
        <aside className="hidden flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-card p-2 lg:flex">
          {pages.map((page, index) => {
            const status = pageStatus(page);
            const active = page.id === activePageId;
            return (
              <div key={page.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    setActivePageId(page.id);
                    setSelectedBlockId(null);
                  }}
                  aria-current={active}
                  className={cn(
                    'block w-full rounded-md border p-1.5 text-left text-xs transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'border-primary bg-accent shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-accent/40',
                  )}
                >
                  <div
                    className="overflow-hidden rounded-sm border border-border"
                    style={{ height: Math.round(A4_H * THUMB_SCALE), backgroundColor: paperColor }}
                  >
                    <div style={{ transform: `scale(${THUMB_SCALE})`, transformOrigin: 'top left' }}>
                      <JournalPageView
                        page={page}
                        index={index}
                        total={pages.length}
                        edition={journal.reference_month || ''}
                        unitName={unitName}
                        paperColor={paperColor}
                      />
                    </div>
                  </div>
                  <p className="mt-1.5 truncate font-medium text-foreground">
                    Página {String(index + 1).padStart(2, '0')} · {TEMPLATE_LABELS[page.template]}
                  </p>
                  <span
                    className={cn(
                      'mt-0.5 inline-flex items-center gap-1 text-[10px]',
                      status === 'completa' ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {status === 'completa' ? '✓ Completa' : '● Pendente'}
                  </span>
                </button>

                <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-md bg-card/90 p-0.5 opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Mover para cima" onClick={() => movePage(page.id, -1)}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Mover para baixo" onClick={() => movePage(page.id, 1)}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Duplicar página" onClick={() => duplicatePage(page)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" aria-label="Excluir página" onClick={() => removePage(page.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}

          <Select onValueChange={(value) => addPage(value as JournalTemplate)}>
            <SelectTrigger className="h-9 text-xs">
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar página
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_OPTIONS.map((template) => (
                <SelectItem key={template} value={template}>
                  {TEMPLATE_LABELS[template]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </aside>

        {/* Canvas */}
        <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs">
            <span className="font-medium text-muted-foreground">
              Página {pages.findIndex((page) => page.id === activePage.id) + 1} de {pages.length}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* Grupo 1 — histórico */}
              <div className="flex items-center rounded-md border border-border p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Desfazer (Ctrl+Z)"
                  aria-label="Desfazer"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Refazer (Ctrl+Shift+Z)"
                  aria-label="Refazer"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Grupo 2 — zoom / ajuste */}
              <div className="flex items-center rounded-md border border-border p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setManualZoom((z) => z - 0.1)}
                  aria-label="Diminuir zoom"
                >
                  −
                </Button>
                <span className="w-11 text-center tabular-nums text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setManualZoom((z) => z + 0.1)}
                  aria-label="Aumentar zoom"
                >
                  +
                </Button>
                <Button
                  variant={fitMode === 'screen' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7"
                  onClick={() => setFitMode('screen')}
                  title="Ajustar a folha à tela"
                >
                  <Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Ajustar
                </Button>
              </div>

              {/* Grupo 3 — opções da folha */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Opções da folha
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Fundo do jornal
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {JOURNAL_PAPER_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPaper(key)}
                          aria-pressed={paper === key}
                          className={cn(
                            'rounded-md border p-2 text-left text-[11px] transition-colors',
                            paper === key
                              ? 'border-primary bg-accent'
                              : 'border-border hover:bg-accent/40',
                          )}
                        >
                          <span
                            className="mb-1.5 block h-8 w-full rounded-sm border border-border"
                            style={{ backgroundColor: journalPaper(key) }}
                          />
                          {JOURNAL_PAPER_LABELS[key]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Aplica-se a todas as páginas, no preview e no PDF.
                    </p>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Ajuste da visualização
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        variant={fitMode === 'width' ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => setFitMode('width')}
                      >
                        À largura
                      </Button>
                      <Button
                        variant={fitMode === 'height' ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => setFitMode('height')}
                      >
                        À altura
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="col-span-2 h-7 text-[11px]"
                        onClick={() => setManualZoom(() => 1)}
                      >
                        Restaurar 100%
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Layout
                    </p>
                    <Button
                      variant={layoutLocked ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-8 w-full justify-start text-[11px]"
                      onClick={() => setLayoutLocked((value) => !value)}
                    >
                      {layoutLocked ? (
                        <>
                          <Lock className="mr-1.5 h-3.5 w-3.5" /> Layout travado pelo modelo
                        </>
                      ) : (
                        <>
                          <Unlock className="mr-1.5 h-3.5 w-3.5" /> Layout livre
                        </>
                      )}
                    </Button>
                    <p className="text-[10px] text-muted-foreground">
                      Travado: só conteúdo. Livre: tamanho, ordem e posição dos blocos.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>

              {layoutLocked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> Layout travado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] text-accent-foreground">
                  <Unlock className="h-3 w-3" /> Layout livre
                </span>
              )}
            </div>
          </div>

          <div ref={canvasRef} className="flex-1 overflow-auto bg-journal-workspace p-6">
            <div
              style={{
                width: A4_W * zoom,
                height: A4_H * zoom,
                margin: '0 auto',
              }}
            >
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                <JournalPageView
                  page={activePage}
                  index={pages.findIndex((page) => page.id === activePage.id)}
                  total={pages.length}
                  edition={journal.reference_month || ''}
                  unitName={unitName}
                  interactive
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  showGrid={!layoutLocked}
                  paperColor={paperColor}
                  onResizeBlockSpan={layoutLocked ? undefined : resizeBlockSpan}
                  onResizeBlockHeight={layoutLocked ? undefined : resizeBlockHeight}
                  onReorderBlocks={layoutLocked ? undefined : reorderBlocks}
                  onSelectPageArea={() => setSelectedBlockId(null)}
                  className="border border-border shadow-[0_8px_28px_-12px_rgba(0,0,0,0.45)]"
                />
              </div>
            </div>
          </div>
        </section>


        {/* Conteúdo da página */}
        <aside className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-3">
          {layoutLocked ? (
            <p className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">
              Layout do modelo travado: clique em um bloco para trocar o texto ou enviar a imagem.
              Para incluir/remover blocos ou mudar tamanhos, use “Layout livre” na barra do canvas.
            </p>
          ) : (
            <div>
              <Label className="text-xs text-muted-foreground">
                {selectedBlock ? 'Adicionar abaixo do bloco selecionado' : 'Adicionar ao jornal'}
              </Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <Button variant="outline" size="sm" onClick={() => addBlock(textBlock('corpo', 'Novo texto.'))}>
                  <Type className="mr-1.5 h-3.5 w-3.5" /> Texto
                </Button>
                <Button variant="outline" size="sm" onClick={() => addBlock(imageBlock(6, '16/9'))}>
                  <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Imagem
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="col-span-2"
                  onClick={() => addBlock(statBlock())}
                >
                  <Hash className="mr-1.5 h-3.5 w-3.5" /> Número
                </Button>
              </div>
            </div>
          )}

          <JournalBlockList
            blocks={activePage?.blocks ?? []}
            selectedBlockId={selectedBlockId}
            onSelect={setSelectedBlockId}
            onMove={moveBlock}
            locked={layoutLocked}
          />

          <div className="h-px bg-border" />

          <JournalPropertiesPanel
            page={activePage}
            block={selectedBlock}
            onChangeBlock={updateBlock}
            onRemoveBlock={removeBlock}
            onClose={() => setSelectedBlockId(null)}
            locked={layoutLocked}
          />
        </aside>
      </div>

      {/* Container offscreen usado somente na exportação (paridade preview = PDF) */}
      <div ref={exportRef} className="pointer-events-none fixed left-[-20000px] top-0" aria-hidden="true">
        {pages.map((page, index) => (
          <div key={page.id} data-journal-page>
            <JournalPageView
              page={page}
              index={index}
              total={pages.length}
              edition={journal.reference_month || ''}
              unitName={unitName}
              paperColor={paperColor}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default JournalEditor;
