import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToque } from '@/hooks/useToque';

interface Props {
  indice: number;
  total: number;
  rotulo: string;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  className?: string;
}

/**
 * O menu de uma página: mover, duplicar, excluir.
 *
 * Substitui os quatro ícones de 24px que só apareciam ao passar o mouse
 * (varredura de 16/09/2026): no toque eles não existiam, e no desktop eram
 * fáceis de errar. Um botão sempre visível, com 44px de alvo no toque, e os
 * nomes por extenso dentro.
 */
export function MenuDaPagina({ indice, total, rotulo, onMove, onDuplicate, onRemove, className }: Props) {
  const toque = useToque();
  const [aberto, setAberto] = useState(false);
  /**
   * Escolher fecha o menu e só então age: a ação pode abrir um diálogo, e dois
   * focos disputando no mesmo instante (o do menu saindo, o do diálogo
   * entrando) travavam a tela por segundos no ambiente de teste.
   */
  const escolher = (acao: () => void) => () => { setAberto(false); window.setTimeout(acao, 0); };
  const item = cn('w-full justify-start', toque ? 'h-11 text-sm' : 'h-9 text-xs');
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className={cn('shadow-sm', toque ? 'h-11 w-11' : 'h-7 w-7', className)}
          aria-label={`Menu da página ${indice + 1}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className={toque ? 'h-5 w-5' : 'h-4 w-4'} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1.5" onClick={(event) => event.stopPropagation()}>
        <p className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
          Página {indice + 1} · {rotulo}
        </p>
        <Button variant="ghost" className={item} disabled={indice === 0} onClick={escolher(() => onMove(-1))}>
          <ChevronUp className="mr-2 h-4 w-4" /> Mover para cima
        </Button>
        <Button variant="ghost" className={item} disabled={indice === total - 1} onClick={escolher(() => onMove(1))}>
          <ChevronDown className="mr-2 h-4 w-4" /> Mover para baixo
        </Button>
        <Button variant="ghost" className={item} onClick={escolher(onDuplicate)}>
          <Copy className="mr-2 h-4 w-4" /> Duplicar página
        </Button>
        <Button variant="ghost" className={cn(item, 'text-destructive hover:text-destructive')} onClick={escolher(onRemove)}>
          <Trash2 className="mr-2 h-4 w-4" /> Excluir página
        </Button>
      </PopoverContent>
    </Popover>
  );
}
