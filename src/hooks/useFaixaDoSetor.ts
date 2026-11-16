import { useEffect, useSyncExternalStore } from 'react';

/**
 * A faixa do setor some enquanto uma ferramenta de tela cheia está aberta
 * (16/11/2026). O editor do Jornal mede a própria altura pela tela inteira
 * menos a barra; com a faixa da Educação em cima, a folha descia e a página
 * ganhava rolagem. Quem abre a ferramenta pede; ao fechar, a faixa volta.
 */
let pedidos = 0;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((o) => o());
const assinar = (o: () => void) => {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
};

/** Esconde a faixa do setor enquanto o componente estiver montado. */
export function useEsconderFaixaDoSetor(ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    pedidos++;
    avisar();
    return () => {
      pedidos--;
      avisar();
    };
  }, [ativo]);
}

/** A faixa está escondida agora? */
export function useFaixaDoSetorEscondida(): boolean {
  return useSyncExternalStore(assinar, () => pedidos > 0, () => false);
}
