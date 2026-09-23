import { Check, MessageCircle, Printer } from 'lucide-react';
import type { TipoDeArte } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DESCRICAO_DA_ARTE, LIMITE_CONTEUDO, LIMITE_LEGENDA, ROTULO_DA_ARTE, TIPOS_DE_ARTE, type PedidoDeArte as Pedido } from '@/lib/events/arte';

/**
 * O sub-formulário do pedido de arte (22/09/2026, mockup aprovado).
 *
 * Duas escolhas em cartões grandes, que dá para marcar juntas: Arte para o
 * WhatsApp e Cartaz A4. Embaixo, a legenda (só faz sentido com WhatsApp), o
 * que precisa estar na arte e, com cartaz, quantos. Os anexos do marketing
 * já moram logo abaixo, no bloco de fora.
 */
interface Props {
  pedido: Pedido;
  onChange: (pedido: Pedido) => void;
}

const ICONE: Record<TipoDeArte, typeof MessageCircle> = { arte_whatsapp: MessageCircle, cartaz_a4: Printer };

export function PedidoDeArte({ pedido, onChange }: Props) {
  const marcado = (t: TipoDeArte) => (t === 'arte_whatsapp' ? pedido.whatsapp : pedido.cartaz);
  const alternar = (t: TipoDeArte) =>
    onChange(t === 'arte_whatsapp' ? { ...pedido, whatsapp: !pedido.whatsapp } : { ...pedido, cartaz: !pedido.cartaz, quantidade: pedido.cartaz ? null : pedido.quantidade });

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3 shadow-sm animate-in fade-in slide-in-from-top-1" data-testid="pedido-de-arte">
      <div>
        <p className="text-sm font-semibold mb-2">
          O que você precisa? <span className="font-normal text-muted-foreground">— pode marcar os dois</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TIPOS_DE_ARTE.map(t => {
            const Icone = ICONE[t];
            const on = marcado(t);
            return (
              <button
                key={t}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => alternar(t)}
                className={`relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${on ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/50'}`}
                data-testid={`arte-${t}`}
              >
                <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <Icone className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{ROTULO_DA_ARTE[t]}</span>
                  <span className="block text-xs text-muted-foreground">{DESCRICAO_DA_ARTE[t]}</span>
                </span>
                {on && <Check className="absolute right-2.5 top-2.5 h-4 w-4 text-primary" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {pedido.whatsapp && (
        <div>
          <Label htmlFor="arte-legenda" className="text-xs font-medium mb-1 block">
            Legenda para a mensagem <span className="font-normal text-muted-foreground">(vai junto da arte no WhatsApp)</span>
          </Label>
          <Textarea
            id="arte-legenda"
            rows={3}
            maxLength={LIMITE_LEGENDA}
            value={pedido.legenda}
            onChange={e => onChange({ ...pedido, legenda: e.target.value })}
            placeholder="Vem comemorar a primavera com a gente! Sábado, 27/09, das 14h às 18h, na Unidade Nilópolis. Traga a família 🌼"
            className="text-sm bg-background"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Escreva como você mandaria no grupo. O marketing só revisa.</p>
        </div>
      )}

      <div>
        <Label htmlFor="arte-conteudo" className="text-xs font-medium mb-1 block">
          O que precisa estar na arte
        </Label>
        <Textarea
          id="arte-conteudo"
          rows={3}
          maxLength={LIMITE_CONTEUDO}
          value={pedido.conteudo}
          onChange={e => onChange({ ...pedido, conteudo: e.target.value })}
          placeholder='Título "Festa da Primavera", data e horário, endereço da unidade, "entrada gratuita", logo da ANA e do parceiro.'
          className="text-sm bg-background"
        />
      </div>

      {pedido.cartaz && (
        <div className="max-w-[200px]">
          <Label htmlFor="arte-quantidade" className="text-xs font-medium mb-1 block">
            Quantos cartazes?
          </Label>
          <Input
            id="arte-quantidade"
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            className="h-9 bg-background"
            value={pedido.quantidade ?? ''}
            onChange={e => onChange({ ...pedido, quantidade: e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0) })}
            placeholder="6"
          />
        </div>
      )}
    </div>
  );
}

export default PedidoDeArte;
