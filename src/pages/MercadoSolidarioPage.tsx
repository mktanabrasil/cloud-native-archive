import { useRef } from 'react';
import PageHeader from '@/components/PageHeader';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { InstitutionalFooterBar } from '@/components/news/InstitutionalFooterBar';
import { MercadoHero } from '@/components/mercado/MercadoHero';
import { MercadoProposito } from '@/components/mercado/MercadoProposito';
import { MercadoComoAjudar } from '@/components/mercado/MercadoComoAjudar';
import { MercadoAtuacao } from '@/components/mercado/MercadoAtuacao';
import { MercadoContato } from '@/components/mercado/MercadoContato';

/*
 * Esboço V2: só a casca muda aqui. As seções vêm de `components/mercado/*`,
 * que o embed público (`/mercado-solidario-publico`) também usa — por isso
 * ficam como estão, e o redesenho delas é pedido à parte.
 */
export default function MercadoSolidarioPage() {
  const contatoRef = useRef<HTMLDivElement>(null);
  const propositoRef = useRef<HTMLDivElement>(null);
  useTituloDaAba('Mercado Solidário · ANA Brasil');

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Mercado Solidário"
        description="Iniciativa do Grupo ANA Brasil que apoia famílias em situação de vulnerabilidade."
        className="mb-5"
      />

      <div className="space-y-8 md:space-y-10">
        <MercadoHero
          onPartnerClick={() => scrollTo(contatoRef)}
          onLearnClick={() => scrollTo(propositoRef)}
        />
        <div ref={propositoRef} className="scroll-mt-24">
          <MercadoProposito />
        </div>
        <MercadoComoAjudar />
        <MercadoAtuacao />
        <div ref={contatoRef} className="scroll-mt-24">
          <MercadoContato />
        </div>

        <footer className="space-y-3 pt-2">
          <InstitutionalFooterBar className="rounded-full md:h-3" />
          <p className="text-center text-[13px] text-[hsl(var(--fraco,0_0%_45%))]">
            Mercado Solidário — uma iniciativa do Grupo ANA Brasil.
          </p>
        </footer>
      </div>
    </div>
  );
}
