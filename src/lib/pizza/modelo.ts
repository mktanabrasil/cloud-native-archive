import { ACTIVE_NEWS_UNITS, type NewsUnit } from '@/lib/news/units';

/**
 * Pizza da Alegria (07/10/2026): confirmação de pagamento, só para controle.
 *
 * O pedido e o pagamento acontecem na unidade. Pelo link público, quem já
 * pagou confirma o nome, a unidade em que trabalha, os sabores, a forma de
 * pagamento e o comprovante (obrigatório; opcional só no dinheiro). Os
 * mesmos limites estão na função `confirmar_pizza` do banco.
 */

export const PRECO = 50;
export const PRAZO = new Date('2026-12-01T00:00:00-03:00');
export const RETIRADA = 'sexta, 04/12/2026';

export const SABORES = [
  ['marguerita', 'Marguerita'],
  ['frango', 'Frango'],
  ['calabresa', 'Calabresa fatiada'],
  ['mucarela', 'Muçarela'],
  ['lombo', 'Lombo'],
  ['napolitana', 'Napolitana'],
] as const;
export type Sabor = (typeof SABORES)[number][0];

export const FORMAS = [
  ['pix', 'Pix'],
  ['credito', 'Crédito'],
  ['debito', 'Débito'],
  ['dinheiro', 'Dinheiro'],
  ['pluxee', 'Vale Pluxee'],
] as const;
export type Forma = (typeof FORMAS)[number][0];

export type Area = 'educacao' | 'social';
export const ROTULO_DA_AREA: Record<Area, string> = { educacao: 'Educação', social: 'Social' };

/** CEIs e GOE ficam em Educação; as unidades ANA, em Social (decisão de 07/10). */
export const areaDaUnidade = (u: Pick<NewsUnit, 'type'>): Area => (u.type === 'NAVE' ? 'social' : 'educacao');

/** As unidades do formulário, por área, na ordem do app. */
export const UNIDADES_POR_AREA: Array<{ area: Area; unidades: NewsUnit[] }> = (['educacao', 'social'] as Area[]).map((area) => ({
  area,
  unidades: ACTIVE_NEWS_UNITS.filter((u) => areaDaUnidade(u) === area),
}));

export type Quantidades = Partial<Record<Sabor, number>>;

export const totalDePizzas = (q: Quantidades) => Object.values(q).reduce((a: number, n) => a + (n ?? 0), 0);
export const valor = (pizzas: number) => pizzas * PRECO;
export const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const rotuloDoSabor = (s: string) => SABORES.find(([k]) => k === s)?.[1] ?? s;
export const rotuloDaForma = (f: string) => FORMAS.find(([k]) => k === f)?.[1] ?? f;

/** "1 Marguerita · 2 Calabresa fatiada" */
export const resumoDosSabores = (q: Record<string, number>) =>
  SABORES.filter(([k]) => (q[k] ?? 0) > 0).map(([k, r]) => `${q[k]} ${r}`).join(' · ');

export const comprovanteObrigatorio = (f: Forma | null) => f !== null && f !== 'dinheiro';

export const encerrado = (agora: Date = new Date()) => agora >= PRAZO;

/** O que falta para enviar; null quando está tudo certo. */
export function problemaDoEnvio(d: { nome: string; unidade: string | null; quantidades: Quantidades; forma: Forma | null; comprovante: File | null }): string | null {
  if (d.nome.trim().length < 3) return 'Escreva o seu nome completo.';
  if (!d.unidade) return 'Escolha a unidade em que você trabalha.';
  if (totalDePizzas(d.quantidades) === 0) return 'Confirme pelo menos uma pizza.';
  if (!d.forma) return 'Escolha como você pagou.';
  if (comprovanteObrigatorio(d.forma) && !d.comprovante) return 'Anexe o comprovante (foto ou PDF).';
  return null;
}

export const COMPROVANTE_MAX_MB = 10;
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function problemaDoArquivo(f: File): string | null {
  const tipoOk = TIPOS.includes(f.type) || /\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(f.name);
  if (!tipoOk) return 'Use uma foto ou um PDF.';
  if (f.size > COMPROVANTE_MAX_MB * 1024 * 1024) return `O arquivo passa de ${COMPROVANTE_MAX_MB} MB. Tire uma foto em vez de enviar o original.`;
  if (f.size === 0) return 'Este arquivo está vazio.';
  return null;
}

/** Mensagem para quem enviou, a partir do erro do banco. */
export function mensagemDoErro(e: unknown): string {
  const t = String((e as { message?: string })?.message ?? e);
  if (/prazo_encerrado/.test(t)) return 'As confirmações foram encerradas em 30/11.';
  if (/comprovante_obrigatorio|comprovante_nao_encontrado/.test(t)) return 'O comprovante não chegou. Anexe de novo e envie.';
  if (/comprovante_repetido/.test(t)) return 'Este comprovante já foi enviado.';
  if (/nome_invalido/.test(t)) return 'Confira o seu nome.';
  return 'Não deu para enviar. Confira a internet e tente de novo.';
}
