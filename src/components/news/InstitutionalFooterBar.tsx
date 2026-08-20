import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

/** Tokens semânticos definidos em index.css, na ordem da identidade. */
const BRAND_TONES = [
  'bg-news-brand-1',
  'bg-news-brand-2',
  'bg-news-brand-3',
  'bg-news-brand-4',
  'bg-news-brand-5',
] as const;

interface InstitutionalFooterBarProps extends ComponentProps<'div'> {
  className?: string;
  /**
   * Quantas faixas usar, sempre a partir da primeira cor. Padrão: as cinco.
   * O Jornal reduz para três nas unidades de Educação; os demais usos seguem
   * inalterados.
   */
  stripes?: number;
}

/**
 * Barra institucional de rodapé — faixas iguais, na ordem da paleta.
 */
export function InstitutionalFooterBar({
  className,
  stripes = BRAND_TONES.length,
  ...rest
}: InstitutionalFooterBarProps) {
  const tones = BRAND_TONES.slice(0, Math.max(1, Math.min(BRAND_TONES.length, stripes)));

  return (
    <div
      {...rest}
      className={cn(
        'flex overflow-hidden h-3 md:h-4 print:h-[18px]',
        className
      )}
      aria-hidden="true"
    >
      {tones.map((tone) => (
        <div key={tone} className={cn('flex-1', tone)} />
      ))}
    </div>
  );
}

export default InstitutionalFooterBar;
