import { cn } from '@/lib/utils';
import { A4_H, A4_W, JournalPageView } from './JournalPageView';
import { TEMPLATE_LABELS, type JournalPage, type JournalTemplate } from '@/lib/journal/types';
import { MenuDaPagina } from './MenuDaPagina';
import { Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

/** Largura da miniatura na tira; a altura decorre da proporção A4. */
const STRIP_W = 46;
const STRIP_SCALE = STRIP_W / A4_W;

interface Props {
  pages: JournalPage[];
  activePageId: string;
  onSelect: (pageId: string) => void;
  /** Estado de preenchimento, para o ponto de pendência. */
  statusOf: (page: JournalPage) => 'completa' | 'pendente';
  paperColor: string;
  edition: string;
  unitName: string;
  unitId?: string | null;
  /** Mover, duplicar, excluir e adicionar: no celular a tira é o único lugar das páginas. */
  acoes?: {
    onMove: (id: string, direction: -1 | 1) => void;
    onDuplicate: (id: string) => void;
    onRemove: (id: string) => void;
    onAdd: (template: JournalTemplate) => void;
    templates: readonly JournalTemplate[];
  };
}

/**
 * Navegação de páginas para telas estreitas.
 *
 * É a coluna de miniaturas do desktop, deitada. Existe porque abaixo de 1024px
 * aquela coluna some (`hidden lg:flex`) e, com ela, o *único* lugar que trocava
 * a página ativa — no celular a pessoa abria o jornal e ficava presa na
 * primeira página.
 *
 * Mostra a miniatura de verdade, e não só o número, porque reconhecer a página
 * pelo desenho é mais rápido do que pelo rótulo: numa edição de seis páginas,
 * "Capa" e "Matéria" dizem pouco depois que o conteúdo entra.
 */
export function JournalPageStrip({
  pages,
  activePageId,
  onSelect,
  statusOf,
  paperColor,
  edition,
  unitName,
  unitId,
  acoes,
}: Props) {
  return (
    <div
      // `shrink-0` porque ela vive num flex column: sem isso a tira seria
      // espremida pelo canvas quando a folha crescer.
      className="flex shrink-0 gap-2 overflow-x-auto rounded-lg border border-border bg-card p-2 lg:hidden"
      role="tablist"
      aria-label="Páginas do jornal"
    >
      {pages.map((page, index) => {
        const active = page.id === activePageId;
        const pending = statusOf(page) === 'pendente';
        return (
          <div key={page.id} className="relative shrink-0">
          <button
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Página ${index + 1}, ${TEMPLATE_LABELS[page.template]}${pending ? ', pendente' : ''}`}
            onClick={() => onSelect(page.id)}
            className={cn(
              'shrink-0 rounded-md border p-1 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'border-primary bg-accent' : 'border-border hover:bg-accent/40',
            )}
          >
            <div
              className="overflow-hidden rounded-sm border border-border"
              style={{ width: STRIP_W, height: Math.round(A4_H * STRIP_SCALE), backgroundColor: paperColor }}
            >
              <div style={{ transform: `scale(${STRIP_SCALE})`, transformOrigin: 'top left' }}>
                <JournalPageView
                  page={page}
                  index={index}
                  total={pages.length}
                  edition={edition}
                  unitName={unitName}
                  unitId={unitId}
                  paperColor={paperColor}
                />
              </div>
            </div>
            <span className="mt-1 flex items-center justify-center gap-1 text-[10px] tabular-nums text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
              {pending && <i aria-hidden="true" className="h-1 w-1 rounded-full bg-muted-foreground" />}
            </span>
          </button>
          {acoes && active && (
            <MenuDaPagina
              className="absolute -right-1 -top-1"
              indice={index}
              total={pages.length}
              rotulo={TEMPLATE_LABELS[page.template]}
              onMove={(direction) => acoes.onMove(page.id, direction)}
              onDuplicate={() => acoes.onDuplicate(page.id)}
              onRemove={() => acoes.onRemove(page.id)}
            />
          )}
          </div>
        );
      })}
      {acoes && (
        <Select onValueChange={(value) => acoes.onAdd(value as JournalTemplate)}>
          <SelectTrigger
            aria-label="Adicionar página"
            className="h-auto shrink-0 flex-col justify-center gap-1 rounded-md border-dashed px-2 text-[10px] text-muted-foreground [&>svg:last-child]:hidden"
            style={{ width: STRIP_W + 10, minHeight: Math.round(A4_H * STRIP_SCALE) + 26 }}
          >
            <Plus className="h-5 w-5" /> Página
          </SelectTrigger>
          <SelectContent>
            {acoes.templates.map((template) => (
              <SelectItem key={template} value={template}>{TEMPLATE_LABELS[template]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export default JournalPageStrip;
