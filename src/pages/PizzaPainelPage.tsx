import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { PainelDaPizza } from '@/components/pizza/PainelDaPizza';

/** /pizza-da-alegria/painel — o painel fora do Marketing, para o ADM (financeiro), que não entra lá. */
export default function PizzaPainelPage() {
  useTituloDaAba('Pizza da Alegria · Painel');
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8"><PainelDaPizza /></div>;
}
