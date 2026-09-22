import type { AppEvent } from '@/types';

/**
 * Rascunho do formulário de evento, guardado no aparelho (22/09/2026).
 *
 * A gestora começa a preencher, fecha a aba ou o celular apaga, e antes
 * perdia tudo. Agora cada mudança vai para o `localStorage`, por pessoa e por
 * evento ("novo" ou o id do evento em edição). Ao reabrir, o formulário
 * oferece retomar. Salvar com sucesso apaga o rascunho; "Descartar tudo"
 * também.
 *
 * Fica só neste navegador, de propósito: é conveniência, não fonte de
 * verdade. O `localStorage` pode não existir ou lançar (janela privada,
 * dados bloqueados), então tudo aqui engole o erro e segue sem rascunho.
 */
export interface Rascunho {
  form: Partial<AppEvent>;
  /** ISO de quando foi guardado. */
  em: string;
}

const PREFIXO = 'evento-rascunho';

export const chaveDoRascunho = (usuarioId: string | null | undefined, eventoId: string | null | undefined): string =>
  `${PREFIXO}:${usuarioId || 'anonimo'}:${eventoId || 'novo'}`;

const guardaSegura = (): Storage | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export function lerRascunho(chave: string): Rascunho | null {
  const g = guardaSegura();
  if (!g) return null;
  try {
    const bruto = g.getItem(chave);
    if (!bruto) return null;
    const lido = JSON.parse(bruto) as Rascunho;
    if (!lido || typeof lido !== 'object' || !lido.form || typeof lido.em !== 'string') return null;
    return lido;
  } catch {
    return null;
  }
}

export function guardarRascunho(chave: string, form: Partial<AppEvent>, agora: Date = new Date()): void {
  const g = guardaSegura();
  if (!g) return;
  try {
    g.setItem(chave, JSON.stringify({ form, em: agora.toISOString() } satisfies Rascunho));
  } catch {
    // sem espaço ou bloqueado: segue sem rascunho
  }
}

export function apagarRascunho(chave: string): void {
  const g = guardaSegura();
  if (!g) return;
  try {
    g.removeItem(chave);
  } catch {
    // nada a fazer
  }
}

/**
 * O rascunho vale a pena oferecer? Só se difere do que o formulário abriria
 * sozinho — um rascunho igual ao evento salvo não é rascunho.
 */
export const rascunhoDiferente = (rascunho: Rascunho | null, inicial: Partial<AppEvent> | null): rascunho is Rascunho =>
  !!rascunho && JSON.stringify(rascunho.form) !== JSON.stringify(inicial ?? {});

/** "hoje às 14:32" · "ontem às 09:10" · "em 20/09 às 18:05". */
export function quandoFoiGuardado(em: string, agora: Date = new Date()): string {
  const d = new Date(em);
  if (Number.isNaN(d.getTime())) return '';
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const ontem = new Date(agora); ontem.setDate(agora.getDate() - 1);
  if (mesmoDia(d, agora)) return `hoje às ${hora}`;
  if (mesmoDia(d, ontem)) return `ontem às ${hora}`;
  return `em ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${hora}`;
}
