import type { AppEvent } from '@/types';

/**
 * O que esta pessoa pode fazer com este evento nas telas de leitura
 * (13/11/2026): os botões só aparecem quando o banco deixaria.
 *
 * Antes, Editar e a lixeira apareciam para qualquer um que pudesse editar
 * algum evento, inclusive em eventos de outras unidades; o banco recusava e
 * a pessoa via um aviso de erro. A regra espelha a do banco:
 * - comunicação e administração: tudo;
 * - quem é da Administração (eventos e parceiros): todas as unidades;
 * - gestão de unidade: a dela e as delegadas. Editar abre também o
 *   confirmado (o formulário mostra travado); a lixeira, só o que ainda não
 *   foi confirmado, porque o banco não deixa a gestora mexer no confirmado.
 */
export interface PapelParaMexer {
  canEdit: boolean;
  isMarketing: boolean;
  unit: string | null;
  delegatedUnits?: string[] | null;
}

export function podeMexerNoEvento(e: Pick<AppEvent, 'unit' | 'status'>, p: PapelParaMexer): { editar: boolean; lixeira: boolean; arrastar: boolean } {
  if (!p.canEdit) return { editar: false, lixeira: false, arrastar: false };
  if (p.isMarketing) return { editar: true, lixeira: true, arrastar: true };
  const minha = p.unit === 'Administração' || e.unit === p.unit || (p.delegatedUnits ?? []).includes(e.unit);
  const aberto = e.status !== 'confirmado';
  return { editar: minha, lixeira: minha && aberto, arrastar: minha && aberto };
}
