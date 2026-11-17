import { UNITS, type UnitMode } from '@/types';
import { JORNAL_UNIT_GROUPS } from '@/lib/news/units';

/**
 * As unidades da Educação, para os vínculos do Semanário (17/11/2026): os CEIs
 * e o GOE, pelo valor gravado em `profiles.unit` (o mesmo do pedido de acesso).
 */
export const UNIDADES_DA_EDUCACAO = JORNAL_UNIT_GROUPS.flatMap(g => g.units).map(u => ({ valor: u.profileUnit, rotulo: u.name }));

/** As unidades que o seletor do Painel oferece, pelo vínculo (e, sem vínculo, pelo nível). */
export function unidadesDoPainel(mode: UnitMode | undefined, nivel: string): { valor: string; rotulo: string }[] {
  if (mode === 'educacao') return UNIDADES_DA_EDUCACAO;
  return UNITS.filter(u => {
    if (mode === 'fixed-admin') return u === 'Administração';
    if (mode === 'choose') return u !== 'Administração';
    if (nivel === 'gestor_unidade') return u !== 'Administração';
    return true;
  }).map(u => ({ valor: u, rotulo: u }));
}
