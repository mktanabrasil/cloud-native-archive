import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { MarketingItem } from '@/types';
import { Button } from '@/components/ui/button';
import { itensAntigosDeArte, lerPedidoDeArte, pilulasDoPedido } from '@/lib/events/arte';

/**
 * Como o marketing vê o pedido de arte no detalhe do evento (22/09/2026):
 * as pílulas do que foi pedido, a legenda, o que vai na arte, e "Copiar
 * legenda" para levar o texto direto ao grupo. Pedidos do modelo antigo
 * aparecem como "Arte (pedido antigo)".
 */
interface Props {
  itens: MarketingItem[] | null | undefined;
  compacto?: boolean;
}

export function ResumoDoPedidoDeArte({ itens, compacto = false }: Props) {
  const pedido = lerPedidoDeArte(itens);
  const antigos = itensAntigosDeArte(itens);
  const pilulas = pilulasDoPedido(pedido);
  if (pilulas.length === 0 && antigos.length === 0) return null;
  const texto = compacto ? 'text-[11px]' : 'text-sm';
  const rotulo = compacto ? 'text-[10px]' : 'text-[11px]';

  const copiarLegenda = () => {
    navigator.clipboard?.writeText(pedido.legenda);
    toast.success('Legenda copiada', { description: 'Cole no grupo do WhatsApp junto da arte.' });
  };

  return (
    <div className="space-y-2" data-testid="resumo-do-pedido-de-arte">
      {pilulas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pilulas.map(p => (
            <span key={p} className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-semibold">{p}</span>
          ))}
        </div>
      )}
      {pedido.legenda && (
        <div>
          <p className={`${rotulo} font-semibold uppercase tracking-wider text-muted-foreground`}>Legenda</p>
          <p className={`${texto} text-foreground whitespace-pre-wrap`}>{pedido.legenda}</p>
        </div>
      )}
      {pedido.conteudo && (
        <div>
          <p className={`${rotulo} font-semibold uppercase tracking-wider text-muted-foreground`}>Na arte</p>
          <p className={`${texto} text-foreground whitespace-pre-wrap`}>{pedido.conteudo}</p>
        </div>
      )}
      {antigos.map((item, n) => (
        <div key={n}>
          <p className={`${rotulo} font-semibold uppercase tracking-wider text-muted-foreground`}>Arte (pedido antigo) · {item.item}</p>
          {item.description && <p className={`${texto} text-foreground whitespace-pre-wrap`}>{item.description}</p>}
        </div>
      ))}
      {pedido.legenda && !compacto && (
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={copiarLegenda}>
          <Copy className="h-3 w-3" /> Copiar legenda
        </Button>
      )}
    </div>
  );
}

export default ResumoDoPedidoDeArte;
