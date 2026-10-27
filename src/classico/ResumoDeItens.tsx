import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { ItemComDetalhe } from '@/types';
import { Button } from '@/components/ui/button';
import { itensDoResumo, linhasParaCopiar } from '@/lib/events/itens';
import { alimentoEmTexto, limparAlimentos, paraProvidenciar, providenciar, temTabela, textoDoFornecedor } from '@/lib/events/alimentos';

/**
 * A tabelinha: um item por linha, com o seu detalhe ao lado.
 *
 * Aparece no formulário (para conferir enquanto se preenche) e no detalhe
 * do evento (para quem coleta a informação depois). "Copiar lista" cola no
 * WhatsApp um item por linha — é assim que a informação circula.
 *
 * Alimentação desde 22/09/2026: uma refeição com tabelinha vira uma tabela
 * própria (alimento, quantidade, providenciar, quem fornece) e o cardápio;
 * no topo, "Para providenciar", que é o que a coordenação procura. Refeição
 * antiga, só com texto, continua na linha de sempre.
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
  const comTabela = lista.filter(temTabela);
  const semTabela = lista.filter(i => !temTabela(i));
  const providenciarLista = paraProvidenciar(lista);
  const texto = compacto ? 'text-[11px]' : 'text-xs';

  const copiarLista = () => {
    navigator.clipboard?.writeText(linhasParaCopiar(titulo, itens));
    toast.success('Lista copiada', { description: `${titulo}: ${lista.length} ${lista.length === 1 ? 'item' : 'itens'}, um por linha.` });
  };

  const pilula = (sim: boolean) => (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${sim ? 'bg-amber-200 text-amber-950 dark:bg-amber-400/25 dark:text-amber-100' : 'bg-muted text-muted-foreground'}`}>
      {sim ? 'Sim' : 'Não'}
    </span>
  );

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

      {providenciarLista.length > 0 && (
        <p className={`mb-2 rounded-md bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/30 px-2.5 py-1.5 ${texto} text-foreground`} data-testid="para-providenciar">
          <b>Para providenciar:</b> {providenciarLista.length} {providenciarLista.length === 1 ? 'item' : 'itens'} · {providenciarLista.map(p => alimentoEmTexto(p.alimento)).join(', ')}
        </p>
      )}

      <div className="space-y-2">
        {comTabela.map(i => {
          const alimentos = limparAlimentos(i.alimentos);
          return (
            <div key={i.item} className="overflow-hidden rounded-md border border-border" data-testid={`refeicao-${i.item}`}>
              <p className={`bg-muted/60 px-2.5 py-1.5 font-semibold text-foreground ${texto}`}>{i.item}</p>
              {alimentos.length > 0 ? (
                // Rola de lado no celular: com overflow-hidden no cartão, a coluna
                // "Quem fornece" era cortada sem aviso (varredura de 25/09/2026).
                <div className="overflow-x-auto" data-testid="rolagem-da-tabela">
                <table className={`w-full min-w-[420px] ${texto}`}>
                  <thead>
                    <tr className="border-t border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2.5 py-1 font-semibold">Alimento</th>
                      <th className="px-2.5 py-1 font-semibold">Qtd.</th>
                      <th className="px-2.5 py-1 font-semibold">Providenciar</th>
                      <th className="px-2.5 py-1 font-semibold">Quem fornece</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alimentos.map((a, n) => (
                      <tr key={n} className="border-t border-border align-top">
                        <td className="px-2.5 py-1.5 text-foreground">{a.nome}</td>
                        <td className="px-2.5 py-1.5 text-foreground whitespace-nowrap">{a.quantidade || '—'}</td>
                        <td className="px-2.5 py-1.5">{pilula(providenciar(a))}</td>
                        <td className="px-2.5 py-1.5 text-foreground">{textoDoFornecedor(a)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              ) : (
                <p className={`px-2.5 py-1.5 italic text-muted-foreground border-t border-border ${texto}`}>— sem alimentos ainda</p>
              )}
              {i.cardapio && (
                <p className={`border-t border-border px-2.5 py-1.5 ${texto} text-foreground`}>
                  <span className="font-semibold text-muted-foreground">Cardápio:</span> {i.cardapio}
                </p>
              )}
              {i.detalhes && (
                <p className={`border-t border-border px-2.5 py-1.5 ${texto} text-muted-foreground`}>
                  <span className="font-semibold">Observação antiga:</span> {i.detalhes}
                </p>
              )}
            </div>
          );
        })}

        {semTabela.length > 0 && (
          <div className="overflow-hidden rounded-md border border-border">
            <table className={`w-full ${texto}`}>
              <tbody>
                {semTabela.map(i => (
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
    </div>
  );
}

export default ResumoDeItens;
