import { ArrowRight } from 'lucide-react';
import { PUBLIC_APP_ORIGIN } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import bannerAsset from '@/assets/mercado-solidario-banner.svg.asset.json';

const BANNER_URL = /^https?:\/\//.test(bannerAsset.url)
  ? bannerAsset.url
  : `${PUBLIC_APP_ORIGIN}${bannerAsset.url}`;

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
            <img
              src={BANNER_URL}
              alt="Banner institucional do Mercado Solidário"
              className="absolute inset-0 h-full w-full object-contain"
              loading="eager"
              decoding="async"
            />
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
