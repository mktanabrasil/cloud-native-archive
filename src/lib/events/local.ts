import type { Unit } from '@/types';

/**
 * O local do evento: uma lista com os lugares da ANA e "Outro local".
 *
 * Até 10/09/2026 o campo era texto livre, e a mesma unidade saía escrita de
 * cinco jeitos no card público ("Santana", "Unidade Santana", "santana"...).
 * Agora a lista grava um nome padronizado; "Outro local" grava o que a pessoa
 * escreveu. O banco continua com a coluna `location` de texto — sem migração —
 * e um evento antigo é reconhecido pelo texto: se bate com um lugar da lista,
 * cai na opção; senão, cai em "Outro local" com o texto preservado.
 *
 * Decisões de 10/09/2026: "Unidade DIC / Nilópolis / Santana", a sede como
 * "Escritório", só o nome (sem endereço), e o local vem sugerido pela unidade.
 */
export interface LocalFixo {
  /** O que vai para `location`. */
  valor: string;
  /** A unidade do evento que sugere este local. */
  unidade: Unit;
}

export const LOCAIS_FIXOS: LocalFixo[] = [
  { valor: 'Unidade DIC', unidade: 'DIC' },
  { valor: 'Unidade Nilópolis', unidade: 'Nilópolis' },
  { valor: 'Unidade Santana', unidade: 'Santana' },
  { valor: 'Escritório', unidade: 'Administração' },
];

/** O valor da opção "Outro local" na lista. Nunca vai para o banco. */
export const OUTRO_LOCAL = '__outro__';

const normalizar = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** O local que a unidade do evento sugere. */
export const localDaUnidade = (unidade: Unit | string | null | undefined): string =>
  LOCAIS_FIXOS.find(l => l.unidade === unidade)?.valor ?? '';

/** O texto gravado bate com um lugar da lista? Ignora caixa, acentos e espaços nas pontas. */
export const localFixo = (texto: string | null | undefined): LocalFixo | undefined => {
  if (!texto) return undefined;
  const n = normalizar(texto);
  return LOCAIS_FIXOS.find(l => normalizar(l.valor) === n);
};

/** Qual opção da lista representa o texto gravado. */
export const opcaoDoLocal = (texto: string | null | undefined): string =>
  localFixo(texto)?.valor ?? OUTRO_LOCAL;

/**
 * Ao trocar a unidade do evento: sugere o local dela, salvo se a pessoa já
 * escreveu um local próprio. Um local fixo de outra unidade é trocado; um
 * texto livre fica.
 */
export const localAoTrocarUnidade = (localAtual: string | null | undefined, novaUnidade: Unit | string): string => {
  if (localAtual && !localFixo(localAtual)) return localAtual;
  return localDaUnidade(novaUnidade);
};
