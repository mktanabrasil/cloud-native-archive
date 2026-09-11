import { useEffect } from 'react';

/**
 * O título da aba do navegador enquanto o componente estiver montado.
 *
 * A aplicação inteira dizia "ANA Brasil": duas abas com eventos diferentes
 * eram indistinguíveis, e o histórico do navegador também. Cada troca guarda
 * o título anterior e o devolve ao sair, então ao fechar o detalhe a aba
 * volta a ser a página, e ao sair da página volta a ser o que era antes.
 */
export function useTituloDaAba(titulo: string) {
  useEffect(() => {
    const antes = document.title;
    document.title = titulo;
    return () => {
      document.title = antes;
    };
  }, [titulo]);
}
