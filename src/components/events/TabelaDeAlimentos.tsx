import { Plus, X } from 'lucide-react';
import type { Alimento, Fornecedor } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FORNECEDORES, LIMITE_CAMPO, LIMITE_CARDAPIO, novoAlimento, providenciar } from '@/lib/events/alimentos';

/**
 * A tabelinha de uma refeição no formulário (22/09/2026, mockup aprovado).
 *
 * Uma linha por alimento: nome, quantidade, "precisamos providenciar?" e
 * quem fornece. "Sim" trava o fornecedor na ANA; "Não" abre a escolha entre
 * Unidade, Parceiro e Doação, com um campo para o nome. Embaixo, o cardápio
 * da refeição. Se a refeição tinha o texto livre de antes, ele fica visível e
 * editável como "Observação antiga" — não se apaga o que foi escrito.
 *
 * No celular cada linha vira um cartão de duas colunas; na tela larga é uma
 * grade. Os selects são nativos: abrem o rolo do sistema no toque, que é o
 * que a gestora conhece, e não pesam no teste.
 */
interface Props {
  id: string;
  refeicao: string;
  alimentos: Alimento[];
  onAlimentos: (alimentos: Alimento[]) => void;
  cardapio: string;
  onCardapio: (texto: string) => void;
  /** O texto livre antigo, quando existe. */
  observacaoAntiga?: string;
  onObservacaoAntiga?: (texto: string) => void;
}

export function TabelaDeAlimentos({ id, refeicao, alimentos, onAlimentos, cardapio, onCardapio, observacaoAntiga, onObservacaoAntiga }: Props) {
  const trocar = (n: number, mudanca: Partial<Alimento>) => onAlimentos(alimentos.map((a, i) => (i === n ? { ...a, ...mudanca } : a)));
  const remover = (n: number) => onAlimentos(alimentos.filter((_, i) => i !== n));
  const adicionar = () => onAlimentos([...alimentos, novoAlimento()]);

  return (
    <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150" data-testid={`${id}-tabela`}>
      {alimentos.length > 0 && (
        <div className="hidden md:grid grid-cols-[1.4fr_1fr_auto_1.3fr_28px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Alimento</span>
          <span>Quantidade</span>
          <span>Precisamos providenciar?</span>
          <span>Quem fornece</span>
          <span />
        </div>
      )}

      {alimentos.map((a, n) => {
        const sim = providenciar(a);
        const base = `${id}-alimento-${n}`;
        return (
          <div key={n} className="relative grid grid-cols-2 md:grid-cols-[1.4fr_1fr_auto_1.3fr_28px] gap-2 items-start rounded-lg border border-border bg-background p-2 md:p-1.5 md:border-0 md:bg-transparent" data-testid={`${base}`}>
            <Input
              id={`${base}-nome`}
              aria-label={`Alimento ${n + 1} de ${refeicao}`}
              className="h-11 md:h-9 col-span-2 md:col-span-1 mr-12 md:mr-0"
              maxLength={LIMITE_CAMPO}
              value={a.nome}
              onChange={e => trocar(n, { nome: e.target.value })}
              placeholder="Arroz e feijão"
              autoFocus={a.nome === '' && n === alimentos.length - 1}
            />
            <Input
              aria-label={`Quantidade do alimento ${n + 1} de ${refeicao}`}
              className="h-11 md:h-9"
              maxLength={LIMITE_CAMPO}
              value={a.quantidade}
              onChange={e => trocar(n, { quantidade: e.target.value })}
              placeholder="120 porções"
            />
            <div
              role="radiogroup"
              aria-label={`Precisamos providenciar o alimento ${n + 1} de ${refeicao}?`}
              className="inline-flex h-11 md:h-9 rounded-md border border-border overflow-hidden text-xs font-medium self-start"
              // Setas trocam entre Sim e Não, como num grupo de rádio de verdade.
              onKeyDown={e => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                e.preventDefault();
                trocar(n, sim ? { fornecedor: 'Unidade' } : { fornecedor: 'ANA', quem: '' });
                const botoes = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
                botoes[sim ? 1 : 0]?.focus();
              }}
            >
              <button
                type="button"
                role="radio"
                aria-checked={sim}
                tabIndex={sim ? 0 : -1}
                className={`px-4 md:px-3 ${sim ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                onClick={() => trocar(n, { fornecedor: 'ANA', quem: '' })}
              >
                Sim
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!sim}
                tabIndex={!sim ? 0 : -1}
                className={`px-4 md:px-3 border-l border-border ${!sim ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                onClick={() => sim && trocar(n, { fornecedor: 'Unidade' })}
              >
                Não
              </button>
            </div>
            <div className="col-span-2 md:col-span-1 flex gap-1.5 min-w-0">
              {sim ? (
                <p className="h-9 flex items-center px-2.5 rounded-md bg-muted text-xs text-muted-foreground flex-1" data-testid={`${base}-ana`}>
                  ANA providencia
                </p>
              ) : (
                <>
                  <select
                    aria-label={`Quem fornece o alimento ${n + 1} de ${refeicao}`}
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                    value={a.fornecedor}
                    onChange={e => trocar(n, { fornecedor: e.target.value as Fornecedor })}
                  >
                    {FORNECEDORES.filter(f => f !== 'ANA').map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <Input
                    aria-label={`Nome de quem fornece o alimento ${n + 1} de ${refeicao}`}
                    className="h-9 min-w-0 flex-1"
                    maxLength={LIMITE_CAMPO}
                    value={a.quem ?? ''}
                    onChange={e => trocar(n, { quem: e.target.value })}
                    placeholder={a.fornecedor === 'Unidade' ? 'Qual unidade?' : a.fornecedor === 'Parceiro' ? 'Nome do parceiro' : 'Quem doa?'}
                  />
                </>
              )}
            </div>
            <button
              type="button"
              aria-label={`Remover alimento ${n + 1} de ${refeicao}`}
              // No celular, no canto do cartão e do tamanho de um dedo; na tela
              // larga, a última coluna da linha (varredura de 25/09/2026).
              className="absolute right-1.5 top-1.5 h-11 w-11 md:static md:h-9 md:w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => remover(n)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={adicionar} data-testid={`${id}-adicionar`}>
        <Plus className="h-3.5 w-3.5" /> Adicionar alimento
      </Button>

      <div>
        <Label htmlFor={`${id}-cardapio`} className="text-xs font-medium mb-1 block text-muted-foreground">
          Cardápio: {refeicao.toLowerCase()} <span className="font-normal">(como vai ser servido)</span>
        </Label>
        <Textarea
          id={`${id}-cardapio`}
          rows={2}
          maxLength={LIMITE_CARDAPIO}
          value={cardapio}
          onChange={e => onCardapio(e.target.value)}
          placeholder="Arroz, feijão, frango assado e salada. Servido às 12h30, no refeitório."
          className="min-h-[44px] text-sm bg-background"
        />
      </div>

      {observacaoAntiga !== undefined && observacaoAntiga !== '' && onObservacaoAntiga && (
        <div>
          <Label htmlFor={`${id}-antiga`} className="text-xs font-medium mb-1 block text-muted-foreground">
            Observação antiga <span className="font-normal">(escrita antes da tabelinha; apague quando passar para as linhas)</span>
          </Label>
          <Textarea
            id={`${id}-antiga`}
            rows={2}
            value={observacaoAntiga}
            onChange={e => onObservacaoAntiga(e.target.value)}
            className="min-h-[44px] text-sm bg-background"
          />
        </div>
      )}
    </div>
  );
}

export default TabelaDeAlimentos;
