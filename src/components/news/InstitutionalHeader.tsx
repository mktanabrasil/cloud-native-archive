import { anaLogo } from '@/lib/anaLogo';
import { cn } from '@/lib/utils';

interface InstitutionalHeaderProps {
  tagline?: string;
  className?: string;
}

/**
 * Cabeçalho institucional do documento da notícia.
 * Logo ANA Brasil (esquerda) + tagline (direita) + divisor discreto.
 * Aparece tanto no Preview quanto no PDF (é filho de #pdf-content).
 */
export function InstitutionalHeader({
  tagline = 'INSPIRANDO VOOS MAIS ALTOS',
  className,
}: InstitutionalHeaderProps) {
  return (
    <header
      className={cn('w-full mb-6 avoid-break print:break-inside-avoid', className)}
    >
      <div className="flex items-center justify-between gap-4 pb-4">
        {/* Largura explícita nos dois tamanhos, sem `auto` e sem
            `object-fit`: ver o porquê em `anaLogo`. */}
        <img
          {...anaLogo(48)}
          alt="ANA Brasil"
          data-ana-logo="true"
          className="h-10 w-[100px] md:h-12 md:w-[120px] select-none"
          draggable={false}
        />
        <span className="text-[10px] md:text-xs font-medium uppercase tracking-[0.2em] text-[#1F211F] text-right">
          {tagline}
        </span>
      </div>
      <div className="h-px w-full bg-[#D9D4C4]" aria-hidden="true" />
    </header>
  );
}

export default InstitutionalHeader;
