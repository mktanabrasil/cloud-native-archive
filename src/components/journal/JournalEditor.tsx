import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
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
  CheckCircle2,
  RotateCcw,
  Lock,
  Unlock,
  Undo2,
  Redo2,
  Maximize2,
  Settings2,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { JournalPageStrip } from './JournalPageStrip';
import { useIsCompact } from '@/hooks/useIsCompact';
import {
  ErroDeContaminacao,
  diagnosticarContaminacao,
  embutirImagens,
} from '@/lib/journal/embutirImagens';
import { prepararClone } from '@/lib/journal/prepararClone';

import {
  DEFAULT_DECORATION_COLOR,
  JOURNAL_PAPER_KEYS,
  JOURNAL_PAPER_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  TEMPLATE_LABELS,
  createDecorationSet,
  journalPaper,
  toJournalPaper,
  type BlockSpan,
  type JournalBlock,
  type JournalColorKey,
  type JournalDecoration,
  type JournalPage,
  type JournalPaperKey,
  type JournalRecord,
  type JournalTemplate,
} from '@/lib/journal/types';
import {
  TEMPLATE_OPTIONS,
  createPage,
  setDecorationsOnAllPages,
  imageBlock,
  statBlock,
  textBlock,
  uid,
} from '@/lib/journal/templates';
import { rowSiblings } from '@/lib/journal/rows';
import { JournalTutorial } from './JournalTutorial';
import { jaViu } from '@/lib/journal/tutorial';
import { avisoDeTransbordo, medirFolha, type Transbordo } from '@/lib/journal/transbordo';
import { JournalElementLibrary } from './JournalElementLibrary';
import { JournalDecorationProperties } from './JournalDecorationProperties';
import {
  JOURNAL_CORNER_KEYS,
  type JournalCornerKey,
  type JournalElementKey,
} from '@/lib/journal/elements';
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
      paper?: JournalPaperKey;
    },
  ) => Promise<boolean>;
  /**
   * Jornal de outra unidade: dá para ler e exportar, não para editar.
   *
   * A garantia real é a RLS — o banco recusa a escrita de qualquer jeito. Este
   * modo existe para a tela não mentir: sem ele, a pessoa arrastaria blocos,
   * veria a folha mudar e perderia tudo ao sair, porque o autosave falha em
   * silêncio.
   */
  somenteLeitura?: boolean;
  /** Só aparece no modo leitura: a cópia nasce na unidade de quem duplicou. */
  onDuplicarParaMinhaUnidade?: () => void;
  /**
   * Mover o jornal para outra unidade é da comunicação, não da gestão.
   *
   * Para a gestora o seletor sequer aparece: a RLS recusaria a troca (o
   * `WITH CHECK` da política de UPDATE), e um controle que só falha é pior
   * do que controle nenhum.
   */
  podeTrocarUnidade?: boolean;
}

/** Largura da miniatura na barra lateral; a altura decorre da proporção A4. */
const THUMB_W = 180;
const THUMB_SCALE = THUMB_W / A4_W;

/**
 * Escalas tentadas em ordem, da melhor para a que sempre cabe.
 *
 * 3x são 288 dpi numa A4; 2x são 192 dpi, ainda imprimíveis. Um jornal de
 * muitas folhas num celular pode não caber na escala cheia, e sair em
 * resolução menor é melhor do que não sair.
 */
const ESCALAS: Record<'digital' | 'impressao', number[]> = {
  impressao: [3, 2, 1.5],
  digital: [1.6, 1.2],
};

/** Estado de preenchimento da página — usado nos selos das miniaturas. */
function pageStatus(page: JournalPage): 'completa' | 'pendente' {
  const pending = page.blocks.some((block) => {
    if (block.kind === 'text') return block.content.trim().length === 0;
    if (block.kind === 'image') return !block.url;
    return false;
  });
  return pending ? 'pendente' : 'completa';
}

export function JournalEditor({
  journal,
  saving,
  savedAt,
  onBack,
  onSave,
  somenteLeitura = false,
  onDuplicarParaMinhaUnidade,
  podeTrocarUnidade = false,
}: Props) {
  const [name, setName] = useState(journal.name);
  const [pages, setPages] = useState<JournalPage[]>(journal.pages?.length ? journal.pages : [createPage('capa')]);
  const [activePageId, setActivePageId] = useState<string>(pages[0].id);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  /** Forma selecionada na lista — exclusiva em relação ao bloco selecionado. */
  const [selectedCorner, setSelectedCorner] = useState<JournalCornerKey | null>(null);
  const [zoom, setZoom] = useState(0.7);
  /** Layout do modelo travado: só o conteúdo é editável (padrão). */
  const [layoutLocked, setLayoutLocked] = useState(true);
  /** Modo de ajuste da folha: tela, largura, altura ou zoom manual (null). */
  const [fitMode, setFitMode] = useState<'screen' | 'width' | 'height' | null>('screen');
  /** Fundo da folha — vale para canvas, miniatura, preview e PDF. */
  const [paper, setPaper] = useState<JournalPaperKey>(() => toJournalPaper(journal.paper));
  const paperColor = journalPaper(paper);
  /** Rótulo de conclusão da edição. Não trava nada — só informa. */
  const [status, setStatus] = useState<JournalRecord['status']>(journal.status);
  const [exporting, setExporting] = useState(false);
  /**
   * Abaixo de 1024px canvas e painel nao cabem lado a lado, e empilhar os dois
   * deixa ambos pequenos demais para servir. Uma coisa de cada vez rende mais.
   */
  const compacto = useIsCompact();
  const [abaMovel, setAbaMovel] = useState<'folha' | 'conteudo'>('folha');
  const exportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  /** Histórico de desfazer/refazer das páginas (limite de 50 passos). */
  const pagesRef = useRef<JournalPage[]>(pages);
  const undoStack = useRef<JournalPage[][]>([]);
  const redoStack = useRef<JournalPage[][]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  /** Tutorial do editor: abre sozinho na primeira edição que ela abrir. */
  const [tutorial, setTutorial] = useState(false);
  useEffect(() => {
    // Só para quem pode editar: em modo leitura, metade dos passos aponta
    // para controles que nem estão na tela.
    if (!somenteLeitura && !jaViu('editor')) setTutorial(true);
  }, [somenteLeitura]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];
  const selectedBlock = activePage?.blocks.find((block) => block.id === selectedBlockId);
  // Memoizado: sem isso o `?? []` devolve um array novo a cada render e
  // invalida os useCallback que dependem dele.
  const decorations = useMemo(() => activePage?.decorations ?? [], [activePage?.decorations]);
  const selectedDecoration = decorations.find((entry) => entry.corner === selectedCorner);
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
      // Piso baixo de proposito: numa tela estreita o ajuste pede menos que
      // 0,3, e travar ai fazia a folha transbordar a propria area.
      setZoom(Math.max(0.15, Math.min(1.5, Number(next.toFixed(3)))));
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitMode]);

  // Autosave com 2s de inatividade.
  useEffect(() => {
    if (somenteLeitura || !dirtyRef.current) return;
    const timer = setTimeout(() => {
      onSave(journal.id, { name, pages, paper });
      dirtyRef.current = false;
    }, 2000);
    return () => clearTimeout(timer);
  }, [somenteLeitura, name, pages, paper, journal.id, onSave]);

  /**
   * Alterna entre rascunho e finalizado, e grava na hora em vez de esperar o
   * autosave: é uma decisão explícita, não uma digitação — a etiqueta tem de
   * mudar junto com o clique.
   *
   * A volta existe de propósito. Sem ela, um erro de digitação achado depois
   * deixaria a edição presa como finalizada.
   */
  const toggleStatus = useCallback(() => {
    if (somenteLeitura) return;
    const next = status === 'finalizado' ? 'rascunho' : 'finalizado';
    setStatus(next);
    onSave(journal.id, { status: next });
  }, [somenteLeitura, status, journal.id, onSave]);

  const setManualZoom = useCallback((updater: (current: number) => number) => {
    setFitMode(null);
    setZoom((current) => Math.max(0.15, Math.min(1.5, updater(current))));
  }, []);


  const mutatePages = useCallback((updater: (prev: JournalPage[]) => JournalPage[]) => {
    // Um portão para todas as edições: mover, redimensionar, trocar texto,
    // incluir e excluir bloco ou página passam por aqui.
    if (somenteLeitura) return;
    dirtyRef.current = true;
    undoStack.current = [...undoStack.current.slice(-49), pagesRef.current];
    redoStack.current = [];
    setHistoryTick((t) => t + 1);
    setPages(updater);
  }, [somenteLeitura]);

  /**
   * Quanto desta página está sobrando para fora da folha.
   *
   * Sem isto o excesso some em silêncio: a folha recorta, e nem a tela nem o
   * PDF dão sinal. Medimos depois da pintura porque antes dela as alturas
   * ainda são as do conteúdo anterior.
   */
  const [transbordo, setTransbordo] = useState<Transbordo | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setTransbordo(medirFolha(document.querySelector<HTMLElement>('[data-journal-canvas="true"]')));
    }, 80);
    return () => window.clearTimeout(id);
  }, [activePage, somenteLeitura]);

  /**
   * Move para uma página nova tudo o que não coube.
   *
   * Quem decide é ela, e não o sistema: a quebra automática cairia no ponto em
   * que a medida estourou, que raramente é o ponto em que a matéria deveria
   * virar de página.
   */
  const moverExcedente = useCallback(() => {
    if (!transbordo?.transborda) return;
    const corte = transbordo.primeiraFora;
    // Cortar no primeiro bloco esvaziaria esta página e só mudaria o problema
    // de lugar.
    if (corte <= 0) return;

    mutatePages((prev) => {
      const indice = prev.findIndex((page) => page.id === activePage.id);
      if (indice < 0) return prev;
      const atual = prev[indice];
      const ficam = atual.blocks.slice(0, corte);
      const vao = atual.blocks.slice(corte);
      if (!ficam.length || !vao.length) return prev;

      const nova: JournalPage = {
        id: uid(),
        template: 'materia',
        blocks: vao,
        ...(atual.decorations ? { decorations: atual.decorations } : {}),
      };
      return [...prev.slice(0, indice), { ...atual, blocks: ficam }, nova, ...prev.slice(indice + 1)];
    });
  }, [activePage.id, mutatePages, transbordo]);

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

  /**
   * Dá a todos os blocos da fileira a altura do bloco escolhido.
   *
   * A altura vem medida do canvas, e não do modelo: um bloco sem `height` tem
   * altura intrínseca (a proporção da imagem, o texto que coube), e o modelo
   * não sabe qual é. A medida é dividida pela escala do zoom para virar px do
   * documento — é a mesma conta do arraste da alça.
   */
  const equalizeRowHeights = useCallback(
    (blockId: string) => {
      const canvas = document.querySelector<HTMLElement>('[data-journal-canvas="true"]');
      const alvo = canvas?.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
      if (!canvas || !alvo) return;

      const escala = alvo.offsetHeight > 0 ? alvo.getBoundingClientRect().height / alvo.offsetHeight : 1;
      const altura = Math.round(alvo.getBoundingClientRect().height / (escala || 1));
      const irmas = rowSiblings(activePage.blocks, blockId);
      if (irmas.length === 0) return;

      const naFileira = new Set([blockId, ...irmas]);
      mutatePages((prev) =>
        prev.map((page) =>
          page.id !== activePage.id
            ? page
            : {
                ...page,
                blocks: page.blocks.map((block) =>
                  naFileira.has(block.id) ? ({ ...block, height: altura } as JournalBlock) : block,
                ),
              },
        ),
      );
    },
    [activePage.blocks, activePage.id, mutatePages],
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

  /**
   * As formas valem para o jornal inteiro: toda operação regrava as quatro em
   * todas as páginas. Entra no histórico e no autosave como qualquer edição.
   */
  const setDecorations = useCallback(
    (next: JournalDecoration[]) => {
      mutatePages((prev) => setDecorationsOnAllPages(prev, next));
    },
    [mutatePages],
  );

  /** Escolher na biblioteca aplica a mesma forma nos quatro cantos, em todas as páginas. */
  const addDecorationSet = useCallback(
    (element: JournalElementKey) => {
      setDecorations(createDecorationSet(element));
      setSelectedBlockId(null);
      setSelectedCorner(JOURNAL_CORNER_KEYS[0]);
    },
    [setDecorations],
  );

  /**
   * Com cantos removidos, repõe só o que falta — mantendo as formas que
   * sobraram, para não desfazer um ajuste de cor já feito. De quebra devolve a
   * lista à ordem canônica dos cantos.
   */
  const restoreMissingDecorations = useCallback(() => {
    const remaining = decorations[0];
    if (!remaining || decorations.length >= JOURNAL_CORNER_KEYS.length) return;
    const byCorner = new Map(decorations.map((decoration) => [decoration.corner, decoration]));
    setDecorations(
      JOURNAL_CORNER_KEYS.map(
        (corner) =>
          byCorner.get(corner) ?? {
            element: remaining.element,
            corner,
            color: DEFAULT_DECORATION_COLOR,
          },
      ),
    );
  }, [decorations, setDecorations]);

  const setDecorationColor = useCallback(
    (corner: JournalCornerKey, color: JournalColorKey) => {
      setDecorations(
        decorations.map((decoration) =>
          decoration.corner === corner ? { ...decoration, color } : decoration,
        ),
      );
    },
    [decorations, setDecorations],
  );

  const removeDecoration = useCallback(
    (corner: JournalCornerKey) => {
      setDecorations(decorations.filter((decoration) => decoration.corner !== corner));
      setSelectedCorner((current) => (current === corner ? null : current));
    },
    [decorations, setDecorations],
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
    // Herda as formas do jornal — sem isso a página nova nasceria sem elas.
    const page: JournalPage = {
      ...createPage(template),
      decorations: decorations.length ? decorations : undefined,
    };
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

  /**
   * Espera as imagens da folha estarem decodificadas antes de rasterizar.
   *
   * O html2canvas desenha o que encontra no instante em que roda: imagem ainda
   * não decodificada vira nada, sem erro. O contêiner de exportação vive fora
   * da tela, e no celular o navegador adia a decodificação do que está longe —
   * daí o logo sair no desktop e sumir no celular.
   *
   * O Informativo já fazia esta espera; o Jornal não fazia nenhuma. O limite
   * por imagem existe para uma imagem quebrada não travar a exportação inteira.
   */
  const aguardarImagens = async (raiz: HTMLElement) => {
    await document.fonts?.ready;
    const limite = (promessa: Promise<unknown>) =>
      Promise.race([promessa, new Promise((resolve) => setTimeout(resolve, 3000))]);
    await Promise.all(
      Array.from(raiz.querySelectorAll('img')).map((img) =>
        // `decode` não existe em todo ambiente, e chamá-lo direto lança um
        // `TypeError` síncrono que o `.catch()` não pega.
        limite(typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve()),
      ),
    );
  };

  const rasterizar = (
    node: HTMLElement,
    escala: number,
    embutidas: Map<string, string>,
    recorte?: (doc: Document) => void,
    semMedida?: Set<string>,
  ) =>
    html2canvas(node, {
      scale: escala,
      useCORS: true,
      backgroundColor: paperColor,
      width: A4_W,
      height: A4_H,
      windowWidth: A4_W,
      windowHeight: A4_H,
      // O html2canvas espera o `onclone` quando ele devolve promessa, e é
      // disso que depende a espera pelo `decode()` lá dentro.
      onclone: (doc) => {
        // O recorte vem antes: ele fala a linguagem da folha original, e o
        // `prepararClone` troca imagem por `div` no meio do caminho.
        recorte?.(doc);
        return prepararClone(doc, embutidas, semMedida);
      },
    });

  /**
   * Rasteriza as folhas e monta o PDF numa escala dada.
   *
   * O canvas de uma A4 a 3x ocupa cerca de 32 MB em memória de vídeo, e o
   * navegador do celular não segura seis vivos ao mesmo tempo. Cada folha é
   * liberada assim que vira JPEG — sem isso a exportação de um jornal longo
   * morre no meio, e é isso que o `data:,` de folha vazia denuncia.
   */
  const montarPdf = async (
    escala: number,
    qualidadeJpeg: number,
    embutidas: Map<string, string>,
    semMedida: Set<string>,
  ) => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const nodes = Array.from(exportRef.current!.querySelectorAll<HTMLElement>('[data-journal-page]'));

    for (let index = 0; index < nodes.length; index += 1) {
      const canvas = await rasterizar(nodes[index], escala, embutidas, undefined, semMedida);

      let imagem: string;
      try {
        imagem = canvas.toDataURL('image/jpeg', qualidadeJpeg);
      } catch (erro) {
        canvas.width = 0;
        canvas.height = 0;
        if (erro instanceof DOMException && erro.name === 'SecurityError') {
          // Canvas contaminado. Repetir menor não muda nada; o que falta é
          // saber de qual camada veio, e só o aparelho responde isso.
          const veredito = await diagnosticarContaminacao((recorte) =>
            rasterizar(nodes[index], 0.4, embutidas, recorte),
          );
          throw new ErroDeContaminacao(
            `contaminado na folha ${index + 1} de ${nodes.length} · ${veredito} · ${embutidas.size} imagens embutidas`,
          );
        }
        throw erro;
      }
      // Cada folha é liberada antes da próxima: seis canvases de 32 MB vivos
      // ao mesmo tempo não cabem no celular.
      canvas.width = 0;
      canvas.height = 0;

      // Sem memória para o canvas o navegador devolve `data:,` em silêncio, e
      // o PDF sairia com folhas em branco sem ninguém reclamar.
      if (imagem.length < 1000) {
        throw new Error(`a folha ${index + 1} de ${nodes.length} voltou vazia na escala ${escala}`);
      }

      if (index > 0) pdf.addPage();
      pdf.addImage(imagem, 'JPEG', 0, 0, 210, 297);
    }

    return pdf;
  };

  const exportPdf = async (quality: 'digital' | 'impressao') => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      await aguardarImagens(exportRef.current);
      const embutidas = await embutirImagens(exportRef.current);
      // Imagem que o html2canvas não consegue medir não é desenhada, e não
      // avisa. Se acontecer, o usuário fica sabendo em vez de descobrir
      // olhando o PDF.
      const semMedida = new Set<string>();
      const escalas = ESCALAS[quality];
      const qualidadeJpeg = quality === 'impressao' ? 0.98 : 0.9;

      let pdf: jsPDF | null = null;
      let ultimoErro: unknown = null;
      for (const escala of escalas) {
        try {
          // Respiro antes de repetir: o navegador só devolve a memória do canvas
          // anterior no ciclo seguinte, e sem isso a segunda tentativa nasce no
          // mesmo aperto que derrubou a primeira.
          if (ultimoErro) await new Promise((resolve) => setTimeout(resolve, 400));
          pdf = await montarPdf(escala, qualidadeJpeg, embutidas, semMedida);
          if (escala !== escalas[0]) {
            toast.warning('PDF gerado em resolução menor: a folha cheia não coube na memória do aparelho.');
          }
          break;
        } catch (erro) {
          // Contaminação não é falta de memória: escala menor não resolve.
          if (erro instanceof ErroDeContaminacao) throw erro;
          ultimoErro = erro;
        }
      }
      if (!pdf) throw ultimoErro ?? new Error('nenhuma escala funcionou');

      pdf.save(`${name || 'jornal'}.pdf`);
      if (semMedida.size) {
        toast.warning(`Saiu sem: ${Array.from(semMedida).join(', ')}.`, {
          description: 'O navegador não conseguiu medir essas imagens, e o que não tem medida não é desenhado.',
        });
      } else {
        toast.success('PDF gerado.');
      }
    } catch (error) {
      // O erro precisa aparecer: esta exportação já falhou em silêncio vezes
      // demais, e sem a mensagem não há como saber qual camada quebrou.
      console.error('[jornal] falha ao gerar o PDF', error);
      const detalhe = error instanceof Error ? error.message : String(error);
      toast.error('Não foi possível gerar o PDF.', { description: detalhe.slice(0, 200) });
    } finally {
      setExporting(false);
    }
  };

  return (
    // svh e nao vh: no celular o vh mede a tela sem as barras do navegador,
    // e a area util do editor vazava para fora.
    <div className="flex h-[calc(100svh-7rem)] flex-col gap-3">
      {somenteLeitura && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
          <Lock className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Somente leitura · jornal {unitName ? `da ${unitName}` : 'de outra unidade'}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300/80">
              Você pode ler e exportar. Para trabalhar em cima dele, duplique para a sua unidade.
            </p>
          </div>
          {onDuplicarParaMinhaUnidade && (
            <Button size="sm" onClick={onDuplicarParaMinhaUnidade}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicar para minha unidade
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
          <Input
            value={name}
            readOnly={somenteLeitura}
            onChange={(event) => {
              if (somenteLeitura) return;
              dirtyRef.current = true;
              setName(event.target.value);
            }}
            className={cn('h-9 w-56 text-base font-semibold', somenteLeitura && 'border-transparent bg-transparent px-0')}
          />
          {!somenteLeitura && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <Check className="h-3 w-3" data-tutorial="salvo" /> {savedAt ? `Tudo salvo · ${savedAt}` : 'Tudo salvo'}
              </>
            )}
          </span>
          )}
          <Badge className={STATUS_BADGE_CLASSES[status]} variant="secondary" data-tutorial="status">
            {STATUS_LABELS[status]}
          </Badge>
          {/* Some da barra no celular e reaparece no menu: em 375px a barra
              quebrava em duas linhas e comia altura do canvas. */}
          {!somenteLeitura && (
          <Button
            variant={status === 'finalizado' ? 'outline' : 'default'}
            size="sm"
            className="hidden sm:inline-flex"
            onClick={toggleStatus}
          >
            {status === 'finalizado' ? (
              <>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reabrir como rascunho
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Finalizar edição
              </>
            )}
          </Button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {/* Depois do primeiro acesso, é por aqui que ela revê o tutorial. */}
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex"
              onClick={() => setTutorial(true)}
            >
              <GraduationCap className="mr-1.5 h-4 w-4" /> Como usar
            </Button>
            <Button
              size="sm"
              className="hidden sm:inline-flex"
              data-tutorial="pdf"
              onClick={() => exportPdf('impressao')}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Baixar PDF
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Mais opções">
                  ⋯
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 space-y-1.5">
                <div className="sm:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={toggleStatus}
                  >
                    {status === 'finalizado' ? (
                      <>
                        <RotateCcw className="mr-1.5 h-4 w-4" /> Reabrir como rascunho
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Finalizar edição
                      </>
                    )}
                  </Button>
                  <div className="my-1.5 h-px bg-border" />
                </div>
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
          onChangeUnit={
            podeTrocarUnidade && !somenteLeitura
              ? (unitId) => onSave(journal.id, { unitId, profileUnit: profileUnitForNewsUnit(unitId) })
              : undefined
          }
        />
      </div>



      {compacto && (
        <JournalPageStrip
          pages={pages}
          activePageId={activePageId}
          onSelect={(id) => {
            setActivePageId(id);
            setSelectedBlockId(null);
          }}
          statusOf={pageStatus}
          paperColor={paperColor}
          edition={journal.reference_month || ''}
          unitName={unitName}
          unitId={journal.unit_id}
        />
      )}

      {/* Ver a folha e editar o conteudo sao momentos diferentes. Numa tela
          estreita eles se revezam: espremer os dois deixa ambos inuteis. */}
      {compacto && (
        <div
          role="tablist"
          aria-label="Areas do editor"
          className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1"
        >
          {([['folha', 'Folha'], ['conteudo', 'Conteudo']] as const).map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={abaMovel === chave}
              onClick={() => setAbaMovel(chave)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                abaMovel === chave
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent/50',
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[210px_1fr_300px]">
        {/* Miniaturas */}
        <aside
          data-tutorial="paginas"
          className="hidden flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-card p-2 lg:flex"
        >
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
                        unitId={journal.unit_id}
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
        {(!compacto || abaMovel === 'folha') && (
        <section data-tutorial="folha" className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
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
                          onClick={() => {
                            dirtyRef.current = true;
                            setPaper(key);
                          }}
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
                          <Lock className="mr-1.5 h-3.5 w-3.5" /> Formato do modelo protegido
                        </>
                      ) : (
                        <>
                          <Unlock className="mr-1.5 h-3.5 w-3.5" /> Posso mover as peças
                        </>
                      )}
                    </Button>
                    <p className="text-[10px] text-muted-foreground">
                      Protegido: você troca textos e fotos. Liberado: também dá para mover, redimensionar e reordenar as peças.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>

              {layoutLocked ? (
                <span data-tutorial="formato" className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> Formato protegido
                </span>
              ) : (
                <span data-tutorial="formato" className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] text-accent-foreground">
                  <Unlock className="h-3 w-3" /> Formato liberado
                </span>
              )}
            </div>
          </div>

          {/* O corte é silencioso; este aviso é o que impede que ele passe. */}
          {!somenteLeitura && transbordo?.transborda && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-warning/40 bg-warning/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <p className="min-w-0 flex-1 text-xs text-foreground">
                {avisoDeTransbordo(transbordo)}
              </p>
              {transbordo.primeiraFora > 0 && (
                <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={moverExcedente}>
                  Mover para uma página nova
                </Button>
              )}
            </div>
          )}

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
                  unitId={journal.unit_id}
                  interactive={!somenteLeitura}
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
        )}


        {/* Conteúdo da página */}
        {!somenteLeitura && (!compacto || abaMovel === 'conteudo') && (
        <aside data-tutorial="painel" className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-3">
          {layoutLocked && (
            <p className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">
              O formato do modelo está protegido: clique em uma peça para trocar o texto ou enviar a foto.
              Para incluir, remover ou redimensionar peças, libere o formato na barra acima da folha.
            </p>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">
              {!layoutLocked && selectedBlock
                ? 'Adicionar abaixo da peça selecionada'
                : 'Adicionar ao jornal'}
            </Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {/* Blocos alteram o layout — só com o layout livre. A forma ANA não:
                  posição e tamanho são do modelo, então continua disponível travado. */}
              {!layoutLocked && (
                <>
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
                </>
              )}
              <div className="col-span-2">
                {decorations.length === 0 && <JournalElementLibrary onPick={addDecorationSet} />}
                {decorations.length > 0 && decorations.length < JOURNAL_CORNER_KEYS.length && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={restoreMissingDecorations}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Repor formas que faltam
                  </Button>
                )}
                {decorations.length === JOURNAL_CORNER_KEYS.length && (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Formas ANA aplicadas
                  </Button>
                )}
              </div>
            </div>
          </div>

          <JournalBlockList
            blocks={activePage?.blocks ?? []}
            selectedBlockId={selectedBlockId}
            onSelect={(id) => {
              setSelectedCorner(null);
              setSelectedBlockId(id);
            }}
            onMove={moveBlock}
            locked={layoutLocked}
            decorations={decorations}
            selectedCorner={selectedCorner}
            onSelectDecoration={(corner) => {
              setSelectedBlockId(null);
              setSelectedCorner(corner);
            }}
            onRemoveDecoration={removeDecoration}
          />

          <div className="h-px bg-border" />

          {selectedDecoration ? (
            <JournalDecorationProperties
              decoration={selectedDecoration}
              unitId={journal.unit_id}
              onChangeColor={(color) => setDecorationColor(selectedDecoration.corner, color)}
              onRemove={() => removeDecoration(selectedDecoration.corner)}
            />
          ) : (
            <JournalPropertiesPanel
              page={activePage}
              block={selectedBlock}
              onChangeBlock={updateBlock}
              onRemoveBlock={removeBlock}
              onClose={() => setSelectedBlockId(null)}
              locked={layoutLocked}
              rowSiblingCount={
                selectedBlock ? rowSiblings(activePage.blocks, selectedBlock.id).length : 0
              }
              onEqualizeRow={
                selectedBlock ? () => equalizeRowHeights(selectedBlock.id) : undefined
              }
            />
          )}
        </aside>
        )}
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
              unitId={journal.unit_id}
              paperColor={paperColor}
            />
          </div>
        ))}
      </div>

      <JournalTutorial
        percurso="editor"
        aberto={tutorial}
        onFechar={() => setTutorial(false)}
      />
    </div>
  );
}

export default JournalEditor;
