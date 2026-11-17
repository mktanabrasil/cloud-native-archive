import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { SituacaoDoSemanario } from '@/lib/semanario/regras';

/** As peças pequenas do Semanário (17/11/2026), no desenho V2 do app. */

export const Vidro = ({ children, className, ...resto }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) => (
  <section className={cn('glass-2 rounded-[22px]', className)} {...resto}>{children}</section>
);

const TOM: Record<SituacaoDoSemanario, string> = {
  em_preenchimento: 'text-[hsl(var(--warning))]',
  envio_atrasado: 'text-[hsl(var(--destructive))]',
  aguardando_devolutiva: 'text-[hsl(var(--info))]',
  devolutiva_atrasada: 'text-[hsl(var(--destructive))]',
  com_devolutiva: 'text-[hsl(var(--success))]',
};

/** O ponto colorido com o texto, como no mockup. */
export function Selo({ situacao, children, className }: { situacao: SituacaoDoSemanario; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold', TOM[situacao], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{children}
    </span>
  );
}

/** O rótulo dos campos, em caixa alta como no modelo. */
export const Rotulo = ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{children}</label>
);

/** "quarta, 18/11 às 16:20", na hora local. */
export function quando(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dia}, ${dd}/${mm} às ${hh}:${mi}`;
}

/** A devolutiva da orientadora, em destaque (o âmbar dos e-mails). */
export function CaixaDaDevolutiva({ texto, por, em, titulo = 'Devolutiva da orientadora' }: { texto: string; por?: string | null; em?: string | null; titulo?: string }) {
  return (
    <Vidro className="border-l-4 border-[#8a5a00] p-4 dark:border-[#f1d98a]" role="note">
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8a5a00] dark:text-[#f1d98a]">{titulo}</p>
      <p className="mt-1 whitespace-pre-line text-[14.5px] leading-relaxed">{texto}</p>
      {(por || em) && <p className="mt-1 text-[12px] text-muted-foreground">{[por, quando(em)].filter(Boolean).join(' · ')}</p>}
    </Vidro>
  );
}
