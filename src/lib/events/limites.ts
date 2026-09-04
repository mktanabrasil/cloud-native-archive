/**
 * Até onde cada texto do evento pode ir.
 *
 * Nenhuma coluna tinha `CHECK`, nenhum campo tinha limite: um título de 2.000
 * caracteres quebrava o banner público e o card. Os números vieram do que
 * existe (em 04/09/2026 o maior título tinha 87, a maior descrição 574) com
 * folga para o que ainda cabe na tela.
 *
 * A mesma tabela vale para o banco (migração `events_limites_de_texto`) e
 * para o formulário. Mudar aqui sem mudar lá deixa o banco recusando o que a
 * tela aceitou.
 */
export const LIMITES_DE_TEXTO = {
  title: 120,
  location: 160,
  description: 1000,
} as const;

export type CampoComLimite = keyof typeof LIMITES_DE_TEXTO;

export const ROTULOS: Record<CampoComLimite, string> = {
  title: 'Título',
  location: 'Localização',
  description: 'Descrição',
};

export interface Contagem {
  /** "61/120" */
  texto: string;
  usados: number;
  limite: number;
  excedeu: boolean;
  /** Só quando excedeu: "encurte 14 caracteres". */
  aviso: string | null;
}

export function contar(campo: CampoComLimite, valor: string | null | undefined): Contagem {
  const limite = LIMITES_DE_TEXTO[campo];
  const usados = (valor ?? '').length;
  const sobra = usados - limite;
  return {
    texto: `${usados}/${limite}`,
    usados,
    limite,
    excedeu: sobra > 0,
    aviso: sobra > 0 ? `encurte ${sobra} ${sobra === 1 ? 'caractere' : 'caracteres'}` : null,
  };
}

/** A mensagem do campo quando passou do limite, para `validate()`. */
export function erroDeLimite(campo: CampoComLimite, valor: string | null | undefined): string | null {
  const c = contar(campo, valor);
  return c.excedeu ? `${ROTULOS[campo]} passa de ${c.limite} caracteres — ${c.aviso}` : null;
}
