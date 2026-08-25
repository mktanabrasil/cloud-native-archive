import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  JOURNAL_COLOR_HEX,
  JOURNAL_COLOR_KEYS,
  JOURNAL_COLOR_LABELS,
  type JournalColorKey,
} from '@/lib/journal/types';

export interface ColorSwatchPickerProps {
  value?: JournalColorKey;
  onChange: (value: JournalColorKey) => void;
  label?: string;
  className?: string;
  /**
   * Paleta oferecida. Ausente mostra a institucional inteira — só as formas
   * recortam por segmento, e o texto continua com todas as cores.
   */
  colors?: JournalColorKey[];
}

/**
 * Seletor restrito à paleta institucional — sem entrada livre de cor,
 * garantindo que o jornal nunca saia da identidade visual.
 */
export function ColorSwatchPicker({
  value,
  onChange,
  label = 'Cor do texto',
  className,
  colors = JOURNAL_COLOR_KEYS,
}: ColorSwatchPickerProps) {
  const current: JournalColorKey = value ?? 'tinta';

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-xs text-muted-foreground">
        {label} <span className="text-[10px]">(paleta institucional)</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {colors.map((key) => (
          <button
            key={key}
            type="button"
            title={JOURNAL_COLOR_LABELS[key]}
            aria-label={JOURNAL_COLOR_LABELS[key]}
            aria-pressed={current === key}
            onClick={() => onChange(key)}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-full border border-border transition-transform',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              current === key ? 'ring-2 ring-ring ring-offset-2' : 'hover:scale-110',
            )}
            style={{ backgroundColor: JOURNAL_COLOR_HEX[key] }}
          >
            {current === key && (
              <Check
                className="h-3.5 w-3.5"
                style={{ color: key === 'tinta' ? '#FFFFFF' : '#1F211F' }}
              />
            )}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Selecionado: <strong>{JOURNAL_COLOR_LABELS[current]}</strong>
        {current === 'tinta' && ' (padrão)'}
      </p>
    </div>
  );
}

export default ColorSwatchPicker;
