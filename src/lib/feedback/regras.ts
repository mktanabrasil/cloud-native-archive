import { navItems, PAGINAS_DOS_SETORES, setorDoCaminho } from '@/config/navigation';

/**
 * O feedback do app (23/11/2026, mockup aprovado): o botão "Dar feedback" na
 * faixa de cada setor. Só o marketing vê todos (caixa no Painel, PR 2); quem
 * mandou acompanha os seus. Sempre identificado; um print opcional.
 */

export type TipoDeFeedback = 'ideia' | 'erro' | 'falta' | 'elogio';
export type SituacaoDoFeedback = 'novo' | 'analise' | 'feito' | 'nao';
export type Aparelho = 'celular' | 'computador';

/** Os quatro tipos, na ordem do formulário. Os nomes valem também para o e-mail. */
export const TIPOS_DE_FEEDBACK: { id: TipoDeFeedback; nome: string; exemplo: string }[] = [
  { id: 'ideia', nome: 'Ideia ou melhoria', exemplo: 'Seria bom se…' },
  { id: 'erro', nome: 'Algo não funcionou', exemplo: 'Cliquei e…' },
  { id: 'falta', nome: 'Sinto falta de algo', exemplo: 'Não achei onde…' },
  { id: 'elogio', nome: 'Elogio', exemplo: 'Gostei de…' },
];
export const nomeDoTipo = (t: TipoDeFeedback | string) => TIPOS_DE_FEEDBACK.find(x => x.id === t)?.nome ?? 'Feedback';

export const SITUACOES_DO_FEEDBACK: Record<SituacaoDoFeedback, string> = {
  novo: 'Novo',
  analise: 'Em análise',
  feito: 'Feito',
  nao: 'Não vamos fazer',
};

/** O que cabe no texto (o banco confere o mesmo). */
export const LIMITE_DO_TEXTO = 4000;
/** O print: até 8 MB, PNG, JPG ou WebP (o balde confere o mesmo). */
export const LIMITE_DO_PRINT = 8 * 1024 * 1024;
export const TIPOS_DO_PRINT = ['image/png', 'image/jpeg', 'image/webp'];

/** Um feedback como quem mandou vê. */
export interface MeuFeedback {
  id: string;
  tipo: TipoDeFeedback;
  texto: string;
  setor: string | null;
  pagina: string | null;
  situacao: SituacaoDoFeedback;
  resposta: string | null;
  respondido_em: string | null;
  criado_em: string;
}

/**
 * De onde a pessoa está mandando: o setor (o nome da barra) e a página (o
 * nome da faixa). Fora dos setores, nada (o feedback vai só com o endereço).
 */
export function ondeEstou(caminho: string): { setor: string | null; pagina: string | null } {
  const setor = setorDoCaminho(caminho);
  if (!setor) return { setor: null, pagina: null };
  const nome = navItems.find(i => i.to === setor)?.label ?? null;
  const pagina = (PAGINAS_DOS_SETORES[setor] ?? []).find(p => p.aberta(caminho))?.rotulo ?? null;
  return { setor: nome, pagina: pagina && pagina !== nome ? pagina : null };
}

/** "Social › Calendário Anual". */
export const ondeFoi = (f: { setor: string | null; pagina: string | null }) =>
  [f.setor, f.pagina].filter(Boolean).join(' › ') || 'Fora dos setores';

/** Celular ou computador, pelo navegador (toque e tela pequena = celular). */
export function aparelhoDe(ua: string, telaPequena: boolean): Aparelho {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || telaPequena ? 'celular' : 'computador';
}

/** O nome curto do navegador, para ajudar a achar o problema. */
export function navegadorDe(ua: string): string {
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua) || /FxiOS/.test(ua)) return 'Firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Outro';
}

/** O que há de errado com o print escolhido, ou null. */
export function problemaDoPrint(f: Pick<File, 'type' | 'size'>): string | null {
  if (!TIPOS_DO_PRINT.includes(f.type)) return 'Use uma imagem em PNG, JPG ou WebP.';
  if (f.size > LIMITE_DO_PRINT) return 'O print passou de 8 MB. Tire outro ou recorte a imagem.';
  return null;
}

/** "png", "jpg", "webp". */
export const extensaoDoPrint = (tipo: string) => (tipo === 'image/jpeg' ? 'jpg' : tipo === 'image/webp' ? 'webp' : 'png');
