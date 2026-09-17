import { ArrowRight } from 'lucide-react';
import { PUBLIC_APP_ORIGIN } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
/**
 * O banner vem do próprio servidor (varredura de 17/09/2026).
 *
 * Antes ele apontava para um endereço da plataforma onde o app nasceu
 * (`/__l5e/assets-v1/…`), que não existe em app.anabrasil.org: o servidor
 * devolvia a página inicial e o navegador mostrava o quadro vazio. E o
 * original era um SVG de 5,5 MB com a foto embutida. Os arquivos em
 * `public/` são a mesma composição, rasterizada: WebP de 1600 px (~100 KB),
 * WebP de 1000 px para o celular e JPEG de reserva. O prefixo absoluto fica
 * porque a página é embutida no site oficial, onde o caminho relativo seria
 * o do site, não o do app.
 */
const BANNER = {
  webp1600: `${PUBLIC_APP_ORIGIN}/mercado-solidario-banner.webp`,
  webp1000: `${PUBLIC_APP_ORIGIN}/mercado-solidario-banner-1000.webp`,
  jpg: `${PUBLIC_APP_ORIGIN}/mercado-solidario-banner.jpg`,
};

interface MercadoHeroProps {
  onPartnerClick: () => void;
  onLearnClick: () => void;
}

export function MercadoHero({ onPartnerClick, onLearnClick }: MercadoHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-10 lg:p-14 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
        style={{ background: 'hsl(var(--news-brand-4))' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-10 blur-3xl"
        style={{ background: 'hsl(var(--news-brand-5))' }}
      />

      <div className="relative flex flex-col items-center text-center">
        <div className="w-full max-w-5xl">
          <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl">
            <picture>
              <source type="image/webp" srcSet={`${BANNER.webp1000} 1000w, ${BANNER.webp1600} 1600w`} sizes="(max-width: 640px) 100vw, 1024px" />
              <img
                src={BANNER.jpg}
                alt="Banner institucional do Mercado Solidário: juntos podemos transformar alimentos em esperança"
                width={1600}
                height={800}
                className="absolute inset-0 h-full w-full object-contain"
                loading="eager"
                decoding="async"
                data-testid="banner-do-mercado"
              />
            </picture>
          </div>
        </div>

        <div className="mt-8 max-w-3xl">
          <Badge variant="secondary" className="mb-4 uppercase tracking-wider">
            Parceiro Solidário
          </Badge>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Juntos podemos transformar{' '}
            <span style={{ color: 'hsl(var(--news-brand-4))' }}>alimentos</span> em esperança.
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            Comunidade que cuida, alimento que transforma. Mais que um mercado, um movimento
            de solidariedade do Grupo ANA Brasil.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={onPartnerClick} className="gap-2">
              Quero ser parceiro
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={onLearnClick}>
              Conheça o projeto
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
