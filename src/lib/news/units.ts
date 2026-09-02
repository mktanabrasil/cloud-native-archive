/**
 * Fonte canônica das unidades do app.
 *
 * Nasceu para o Informativo — daí a pasta e os nomes com `news` —, mas o
 * Informativo saiu do ar em 02/09/2026 e isto ficou: o Jornal, a tela de
 * acesso e o seletor de unidade leem daqui. Renomear é mexer em oito
 * arquivos; fica para quando houver outro motivo de tocar neles.
 *
 * Derivada de `transparency_configs` (Portal da Transparência), com:
 *  - remoção do prefixo numérico de ordenação de pasta ("1 ", "14 ");
 *  - correção de typos aprovados (Paiuí → Piauí, Paulo Friere → Paulo Freire);
 *  - exclusão das unidades com "(Parceria Finalizada)" do seletor (decisão #3).
 */

export type NewsUnitType = 'Institucional' | 'NAVE' | 'CEI';

export interface NewsUnit {
  /** Slug estável usado como valor do seletor e persistido no rascunho. */
  id: string;
  /** Nome oficial exibido no cabeçalho do preview e do PDF. */
  name: string;
  /** Nome curto usado apenas na interface do editor. */
  short: string;
  type: NewsUnitType;
  /** Unidades inativas não aparecem no seletor, mas continuam legíveis. */
  active: boolean;
  /** Valor equivalente em `profiles.unit`, usado para vincular o usuário à unidade. */
  profileUnit: string;
}

export const NEWS_UNITS: NewsUnit[] = [
  { id: 'goe', name: 'Grupo de Oração Esperança', short: 'GOE', type: 'Institucional', active: true, profileUnit: 'GOE' },

  { id: 'ana-nilopolis', name: 'ANA Jardim Nilópolis', short: 'Nilópolis', type: 'NAVE', active: true, profileUnit: 'Nilópolis' },
  { id: 'ana-dic', name: 'ANA DIC', short: 'DIC', type: 'NAVE', active: true, profileUnit: 'DIC' },
  { id: 'ana-santana', name: 'ANA Jardim Santana', short: 'Santana', type: 'NAVE', active: true, profileUnit: 'Santana' },
  { id: 'ana-piaui', name: 'ANA Piauí', short: 'Piauí', type: 'NAVE', active: true, profileUnit: 'Piauí' },
  { id: 'ana-oziel', name: 'ANA Oziel', short: 'Oziel', type: 'NAVE', active: true, profileUnit: 'Oziel' },

  { id: 'cei-pierre-weil', name: 'CEI Bem Querer Prof. Pierre Weil', short: 'Pierre Weil', type: 'CEI', active: true, profileUnit: 'Pierre Weil' },
  { id: 'cei-calmon', name: 'CEI Bem Querer Sen. João de Medeiros Calmon', short: 'Calmon', type: 'CEI', active: true, profileUnit: 'Calmon' },
  { id: 'cei-velardi-gaspar', name: 'CEI Bem Querer Célia A. J. Velardi Gaspar', short: 'Porto', type: 'CEI', active: true, profileUnit: 'Porto' },
  { id: 'cei-portela-santana', name: 'CEI Bem Querer Rogério L. P. Santana', short: 'São José', type: 'CEI', active: true, profileUnit: 'São José' },
  { id: 'cei-anisio-spinola', name: 'CEI Bem Querer Prof. Anísio Spínola', short: 'Anísio', type: 'CEI', active: true, profileUnit: 'Anísio' },
  { id: 'cei-capanema', name: 'CEI Bem Querer Min. Gustavo Capanema', short: 'Capanema', type: 'CEI', active: true, profileUnit: 'Capanema' },
  { id: 'cei-brizola', name: 'CEI Bem Querer Gov. Leonel de Moura Brizola', short: 'Leonel', type: 'CEI', active: true, profileUnit: 'Leonel' },
  { id: 'cei-paulo-freire', name: 'CEI Bem Querer Paulo Reglus Neves Freire', short: 'Paulo Freire', type: 'CEI', active: true, profileUnit: 'Paulo Freire' },
  { id: 'cei-mayara-masson', name: 'CEI Bem Querer Mayara Masson Christofoletti', short: 'Mayara Masson', type: 'CEI', active: true, profileUnit: 'Mayara Masson' },
  { id: 'cei-ferramola', name: 'CEI Bem Querer Profa. Renata Ferramola', short: 'Ferramola', type: 'CEI', active: true, profileUnit: 'Ferramola' },
  { id: 'cei-vandir', name: 'CEI Bem Querer Vandir Justino da Costa Dias', short: 'Vandir', type: 'CEI', active: true, profileUnit: 'Vandir' },

  // Parcerias finalizadas — fora do seletor (decisão #3), mantidas para leitura de informativos históricos.
  { id: 'cei-midori', name: 'CEI Bem Querer Midori Hamamoto', short: 'Midori', type: 'CEI', active: false, profileUnit: 'Midori' },
  { id: 'cei-bernhard-johnson', name: 'CEI Bem Querer Rev. Bernhard Johnson Jr.', short: 'Eldorado', type: 'CEI', active: false, profileUnit: 'Eldorado' },
  { id: 'cei-nardi-neto', name: 'CEI Bem Querer João Batista Nardi Neto', short: 'João Batista', type: 'CEI', active: false, profileUnit: 'João Batista' },
];

/** Unidades disponíveis para criar novos informativos. */
export const ACTIVE_NEWS_UNITS = NEWS_UNITS.filter((unit) => unit.active);

/** Agrupamento para o seletor: dois grupos apenas — Social (NAVEs) e Educação (CEIs + Institucional). */
export const NEWS_UNIT_GROUPS: { label: string; units: NewsUnit[] }[] = [
  { label: 'Social', units: ACTIVE_NEWS_UNITS.filter((u) => u.type === 'NAVE') },
  {
    label: 'Educação',
    units: ACTIVE_NEWS_UNITS.filter((u) => u.type === 'CEI' || u.type === 'Institucional'),
  },
];

/** Segmento institucional da unidade — o mesmo corte usado em `NEWS_UNIT_GROUPS`. */
export type NewsUnitSegment = 'social' | 'educacao';

/**
 * Segmento da unidade, ou `undefined` quando não há unidade definida.
 *
 * As NAVEs formam o Social; os CEIs e o Institucional (GOE), a Educação —
 * mesma divisão que o seletor já apresenta. Sem unidade não há segmento: quem
 * chama decide o padrão neutro.
 */
export function newsUnitSegment(id: string | undefined | null): NewsUnitSegment | undefined {
  const unit = findNewsUnit(id);
  if (!unit) return undefined;
  return unit.type === 'NAVE' ? 'social' : 'educacao';
}

/**
 * Quantas cores da marca o segmento usa: Educação leva as três primeiras, o
 * Social as cinco. Sem unidade definida vale o padrão neutro das cinco.
 *
 * É a fonte única dessa regra. A faixa do rodapé e a paleta das Formas ANA
 * chamam esta função justamente para não poderem divergir — uma folha com
 * rodapé de três cores e forma azul se contradiz sozinha.
 */
export function brandColorCount(id: string | undefined | null): number {
  return newsUnitSegment(id) === 'educacao' ? 3 : 5;
}

export function findNewsUnit(id: string | undefined | null): NewsUnit | undefined {
  if (!id) return undefined;
  return NEWS_UNITS.find((unit) => unit.id === id);
}

export function newsUnitName(id: string | undefined | null): string {
  return findNewsUnit(id)?.name ?? '';
}

/** Resolve a unidade do catálogo a partir do valor gravado em `profiles.unit`. */
export function newsUnitForProfileUnit(profileUnit: string | null | undefined): NewsUnit | undefined {
  if (!profileUnit) return undefined;
  const target = profileUnit.trim().toLowerCase();
  return NEWS_UNITS.find(
    (unit) => unit.profileUnit.toLowerCase() === target || unit.short.toLowerCase() === target || unit.name.toLowerCase() === target,
  );
}

/** Valor de `profiles.unit` correspondente a um id do catálogo. */
export function profileUnitForNewsUnit(id: string | null | undefined): string {
  return findNewsUnit(id)?.profileUnit ?? '';
}
