import { useRef, type ComponentType, type MouseEvent } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Um campo `datetime-local` que abre o calendário ao clicar.
 *
 * Antes o calendário abria por um truque de CSS: o ícone nativo do Chrome
 * (`::-webkit-calendar-picker-indicator`) era esticado, invisível, por cima
 * do campo inteiro. Em 08/09/2026 ele parou de pegar o clique — o clique
 * passou a cair nos segmentos de data ("dd/mm/aaaa") e o calendário não
 * abria; a pessoa acabava digitando à mão.
 *
 * Aqui o clique no campo, ou no ícone à esquerda, chama `showPicker()` — o
 * mesmo calendário nativo, pedido de frente. Onde o navegador não tem
 * `showPicker` (Safari antigo), o clique só foca o campo e a digitação
 * continua funcionando. Teclar continua igual: Tab entra no campo, setas e
 * números mudam os segmentos.
 */
interface Props {
  value: string;
  onChange: (valor: string) => void;
  icone: ComponentType<{ className?: string }>;
  erro?: boolean;
  id?: string;
  'aria-label'?: string;
}

export function CampoDataHora({ value, onChange, icone: Icone, erro, id, 'aria-label': ariaLabel }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  const abrir = (e?: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    // Só o botão principal, sem modificador: clique com Ctrl/Shift é para
    // selecionar texto, não para abrir.
    if (e && (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey)) return;
    try {
      el.showPicker?.();
    } catch {
      // Sem permissão ou sem suporte: fica o foco, e a digitação segue.
      el.focus();
    }
  };

  return (
    <div className="relative group">
      <Input
        ref={ref}
        id={id}
        type="datetime-local"
        value={value}
        onChange={e => onChange(e.target.value)}
        onClick={abrir}
        aria-label={ariaLabel}
        className={`pl-10 pr-4 h-11 focus-visible:ring-primary/20 focus-visible:border-primary transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden ${
          erro ? 'border-destructive' : 'border-border'
        }`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Abrir calendário"
        onClick={() => abrir()}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
      >
        <Icone className="h-4 w-4" />
      </button>
    </div>
  );
}

export default CampoDataHora;
