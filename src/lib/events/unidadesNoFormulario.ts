import { EVENT_UNITS, UNITS, type Unit } from '@/types';
/**
 * As unidades que o formulário oferece (13/11/2026). A gestora de unidade
 * grava só na dela (e nas delegadas): oferecer as quatro fazia o envio falhar
 * só no fim. A comunicação e a administração veem todas, mais o Grupo. A
 * unidade atual do evento sempre aparece, para o campo não ficar em branco.
 */
export function unidadesNoFormulario(p: { isMarketing: boolean; permissionLevel: string | null; unit: string | null; delegatedUnits?: string[] | null; atual?: string | null }): Unit[] {
  if (p.isMarketing) return EVENT_UNITS;
  if (p.permissionLevel === 'gestor_unidade' && p.unit) {
    const minhas = UNITS.filter(u => u === p.unit || (p.delegatedUnits ?? []).includes(u) || u === p.atual);
    return p.atual === 'Grupo ANA Brasil' ? [...minhas, 'Grupo ANA Brasil'] : minhas;
  }
  return p.atual === 'Grupo ANA Brasil' ? EVENT_UNITS : UNITS;
}
