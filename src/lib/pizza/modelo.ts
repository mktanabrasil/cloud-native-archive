import { ACTIVE_NEWS_UNITS, findNewsUnit, type NewsUnit } from '@/lib/news/units';

/**
 * Pizza da Alegria (07/10/2026): confirmação de pagamento, só para controle.
 *
 * O pedido e o pagamento acontecem na unidade. Pelo link público, quem já
 * pagou confirma o nome, a unidade em que trabalha, os sabores, a forma de
 * pagamento e o comprovante (obrigatório; opcional só no dinheiro). Os
 * mesmos limites estão na função `confirmar_pizza` do banco.
 */

/** R$ 55 desde 09/11/2026 (era R$ 50). O banco calcula o mesmo valor em `confirmar_pizza`. */
export const PRECO = 55;
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

/** Todas as formas, para o painel e a conciliação. 'mercado_pago' é o pagamento online (09/11/2026). */
export const FORMAS = [
  ['pix', 'Pix'],
  ['credito', 'Crédito'],
  ['debito', 'Débito'],
  ['dinheiro', 'Dinheiro'],
  ['pluxee', 'Vale Pluxee'],
  ['mercado_pago', 'Mercado Pago'],
] as const;
export type Forma = (typeof FORMAS)[number][0];

/** As formas de quem pagou na unidade e confirma com comprovante. */
export const FORMAS_NA_UNIDADE = FORMAS.filter(([k]) => k !== 'mercado_pago');

/**
 * Pagar online pelo Mercado Pago (Checkout Pro). Fica desligado até a função
 * `pizza-pagamento` e os segredos estarem no ar: um merge na main publica em
 * um minuto. Para testar no computador: VITE_PIZZA_PAGAR_ONLINE=sim no .env.local.
 */
export const pagarOnlineLigado = () => import.meta.env.VITE_PIZZA_PAGAR_ONLINE === 'sim';

export type Area = 'educacao' | 'social';
export const ROTULO_DA_AREA: Record<Area, string> = { educacao: 'Educação', social: 'Social' };

/** CEIs e GOE ficam em Educação; as unidades ANA, em Social (decisão de 07/10). */
export const areaDaUnidade = (u: Pick<NewsUnit, 'type'>): Area => (u.type === 'NAVE' ? 'social' : 'educacao');

/** Fora das campanhas (Pizza e voluntariado do Natal Feliz), a pedido em 21/10/2026; no resto do app a unidade segue ativa. */
export const FORA_DAS_CAMPANHAS = ['ana-oziel'];

/** Fora só da Pizza, a pedido em 09/11/2026. */
export const FORA_DA_PIZZA = ['ana-piaui'];

/** O escritório não é unidade do app; existe só na Pizza (09/11/2026), no lugar da ANA Piauí. */
export const ESCRITORIO_ADM: NewsUnit = { id: 'escritorio-adm', name: 'Escritório (ADM)', short: 'Escritório', type: 'NAVE', active: true, profileUnit: '' };

/** A unidade da Pizza pelo id: as do app e o escritório. */
export const unidadeDaPizza = (id: string | null | undefined): NewsUnit | undefined => (id === ESCRITORIO_ADM.id ? ESCRITORIO_ADM : findNewsUnit(id));

/** As unidades do formulário, por área, na ordem do app. */
export const UNIDADES_POR_AREA: Array<{ area: Area; unidades: NewsUnit[] }> = (['educacao', 'social'] as Area[]).map((area) => ({
  area,
  unidades: [...ACTIVE_NEWS_UNITS, ESCRITORIO_ADM].filter((u) => areaDaUnidade(u) === area && !FORA_DAS_CAMPANHAS.includes(u.id) && !FORA_DA_PIZZA.includes(u.id)),
}));

export type Quantidades = Partial<Record<Sabor, number>>;

export const totalDePizzas = (q: Quantidades) => Object.values(q).reduce((a: number, n) => a + (n ?? 0), 0);
export const valor = (pizzas: number) => pizzas * PRECO;
export const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** As bandeiras como o Mercado Pago as chama (payment_method.id), no débito com "deb" na frente. */
const BANDEIRAS: Record<string, string> = { visa: 'Visa', master: 'Mastercard', elo: 'Elo', amex: 'American Express', hipercard: 'Hipercard', cabal: 'Cabal' };

/**
 * A forma do pagamento online, para a tela e o comprovante (10/11/2026):
 * "Pix", "Cartão de crédito Visa", "Cartão de débito Elo", "Saldo no Mercado Pago".
 * Vem da order no Mercado Pago (payment_method.type e .id). A mesma regra está na função pizza-drive.
 */
export function formaDoMercadoPago(tipo: string | null | undefined, bandeira: string | null | undefined): string {
  const b = BANDEIRAS[(bandeira ?? '').replace(/^deb/, '')] ?? '';
  if (bandeira === 'pix' || tipo === 'bank_transfer') return 'Pix';
  if (tipo === 'credit_card') return b ? `Cartão de crédito ${b}` : 'Cartão de crédito';
  if (tipo === 'debit_card') return b ? `Cartão de débito ${b}` : 'Cartão de débito';
  if (tipo === 'account_money' || bandeira === 'account_money') return 'Saldo no Mercado Pago';
  return 'Mercado Pago';
}

/** "10/11/2026, 14:32", no horário de Brasília. */
export const dataEHora = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const rotuloDoSabor = (s: string) => SABORES.find(([k]) => k === s)?.[1] ?? s;
export const rotuloDaForma = (f: string) => FORMAS.find(([k]) => k === f)?.[1] ?? f;

/** "1 Marguerita · 2 Calabresa fatiada" */
export const resumoDosSabores = (q: Record<string, number>) =>
  SABORES.filter(([k]) => (q[k] ?? 0) > 0).map(([k, r]) => `${q[k]} ${r}`).join(' · ');

export const comprovanteObrigatorio = (f: Forma | null) => f !== null && f !== 'dinheiro' && f !== 'mercado_pago';

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
  // Sem pagamento na unidade desde 09/11/2026: não mandar a pessoa para lá.
  if (/pagamento_online_indisponivel/.test(t)) return 'O pagamento online está fora do ar agora. Tente de novo em alguns minutos.';
  if (/ja_pago/.test(t)) return 'Este pedido já está pago.';
  if (/falha_no_pagamento/.test(t)) return 'O Mercado Pago não respondeu. Tente de novo em alguns minutos.';
  return 'Não deu para enviar. Confira a internet e tente de novo.';
}
