/**
 * O que a pessoa lê quando o PDF falha (varredura de 16/09/2026).
 *
 * As mensagens técnicas continuam existindo — vão para o console, e são o
 * que permite diagnosticar. Aqui cada uma vira uma frase que diz o que
 * aconteceu e o que fazer, em português.
 */

export interface MensagemDoPdf {
  titulo: string;
  descricao: string;
}

const pagina = (texto: string, padrao: RegExp): number | null => {
  const m = texto.match(padrao);
  return m ? Number(m[1]) : null;
};

export function mensagemDoErroDoPdf(erro: unknown): MensagemDoPdf {
  const texto = erro instanceof Error ? erro.message : String(erro ?? '');

  const contaminada = pagina(texto, /contaminad[ao] na folha (\d+)/i);
  if (contaminada !== null) {
    return {
      titulo: 'Não foi possível gerar o PDF',
      descricao: `Uma foto da página ${contaminada} não pôde ser lida pelo navegador. Troque essa foto e tente de novo.`,
    };
  }

  const vazia = pagina(texto, /folha (\d+) de \d+ voltou vazia/i);
  if (vazia !== null) {
    return {
      titulo: 'Não foi possível gerar o PDF',
      descricao: `Faltou memória para a página ${vazia}. Feche outras abas e tente de novo, ou use “Para enviar por WhatsApp”, que é mais leve.`,
    };
  }

  if (/nenhuma escala funcionou/i.test(texto)) {
    return {
      titulo: 'Não foi possível gerar o PDF',
      descricao: 'Este aparelho não conseguiu montar o PDF. Tente num computador.',
    };
  }

  return {
    titulo: 'Não foi possível gerar o PDF',
    descricao: 'Algo deu errado ao montar o PDF. Tente de novo; se continuar, tente num computador.',
  };
}

/** Fotos que o navegador não conseguiu medir, por página (números a partir de 1). */
export function avisoDeFotosSemMedida(porPagina: Map<number, number>): MensagemDoPdf | null {
  const paginas = Array.from(porPagina.keys()).sort((a, b) => a - b);
  if (paginas.length === 0) return null;
  const total = Array.from(porPagina.values()).reduce((s, n) => s + n, 0);
  const lista = paginas.length === 1 ? `da página ${paginas[0]}` : `das páginas ${paginas.slice(0, -1).join(', ')} e ${paginas[paginas.length - 1]}`;
  return {
    titulo: `O PDF saiu sem ${total === 1 ? '1 foto' : `${total} fotos`} ${lista}`,
    descricao: 'O navegador não conseguiu medir essas fotos, e o que não tem medida não é desenhado. Troque a foto e gere de novo.',
  };
}

/** Páginas que transbordam, para a pergunta antes de gerar. */
export interface PaginaTransbordando { indice: number; pecasFora: number }

export function tituloDoTransbordo(paginas: PaginaTransbordando[]): string {
  if (paginas.length === 1) return `A página ${paginas[0].indice + 1} tem conteúdo que não cabe`;
  return `${paginas.length} páginas têm conteúdo que não cabe`;
}

export function linhaDoTransbordo(p: PaginaTransbordando): string {
  return p.pecasFora === 1 ? '1 peça não cabe' : `${p.pecasFora} peças não cabem`;
}
