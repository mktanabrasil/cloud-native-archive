import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { ItemComDetalhe } from '@/types';
import { Button } from '@/components/ui/button';
import { itensDoResumo, linhasParaCopiar } from '@/lib/events/itens';

/**
 * A tabelinha: um item por linha, com o seu detalhe ao lado.
 *
 * Aparece no formulário (para conferir enquanto se preenche) e no detalhe
 * do evento (para quem coleta a informação depois). "Copiar lista" cola no
 * WhatsApp um item por linha — é assim que a informação circula.
 */
interface Props {
  titulo: string;
  itens: ItemComDetalhe[] | null | undefined;
  /** Texto quando não há item: "Nenhum" ou lista vazia. */
  vazio?: string;
  /** Mostra o botão de copiar (detalhe do evento). */
  copiar?: boolean;
  compacto?: boolean;
}

export function ResumoDeItens({ titulo, itens, vazio = 'nenhum', copiar = false, compacto = false }: Props) {
  const lista = itensDoResumo(itens);

  const copiarLista = () => {
    navigator.clipboard?.writeText(linhasParaCopiar(titulo, itens));
    toast.success('Lista copiada', { description: `${titulo}: ${lista.length} ${lista.length === 1 ? 'item' : 'itens'}, um por linha.` });
  };

  return (
    <div data-testid={`resumo-${titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className={`font-semibold uppercase tracking-wider text-muted-foreground ${compacto ? 'text-[10px]' : 'text-[11px]'}`}>
          {titulo} · {lista.length === 0 ? vazio : `${lista.length} ${lista.length === 1 ? 'item' : 'itens'}`}
        </p>
        {copiar && lista.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={copiarLista}>
            <Copy className="h-3 w-3" /> Copiar lista
          </Button>
        )}
      </div>
      {lista.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border">
          <table className={`w-full ${compacto ? 'text-[11px]' : 'text-xs'}`}>
            <tbody>
              {lista.map(i => (
                <tr key={i.item} className="border-b border-border last:border-b-0 align-top">
                  <td className="whitespace-nowrap bg-muted/60 px-2.5 py-1.5 font-semibold text-foreground">{i.item}</td>
                  <td className={`px-2.5 py-1.5 ${i.detalhes ? 'text-foreground' : 'italic text-muted-foreground'}`}>
                    {i.detalhes || '— sem detalhes ainda'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ResumoDeItens;
