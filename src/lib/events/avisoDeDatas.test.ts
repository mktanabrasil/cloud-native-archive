import { describe, expect, it } from 'vitest';
import { avisoDeDatas } from './avisoDeDatas';
import { unidadesNoFormulario } from './unidadesNoFormulario';
import { locacaoPedida, errosDeTransporte, resumoDoTransporte } from './transporte';

const agora = new Date('2026-11-13T12:00:00-03:00');

describe('o aviso sobre as datas (13/11/2026)', () => {
  it('novo no passado avisa; editando, não', () => {
    expect(avisoDeDatas('2026-11-12T10:00', '2026-11-12T12:00', { novo: true, agora })).toMatch(/já passou/);
    expect(avisoDeDatas('2026-11-12T10:00', '2026-11-12T12:00', { novo: false, agora })).toBeNull();
  });
  it('mais de 7 dias avisa; uma semana, não', () => {
    expect(avisoDeDatas('2026-12-01T08:00', '2026-12-08T08:00', { novo: true, agora })).toBeNull();
    expect(avisoDeDatas('2026-12-01T08:00', '2027-12-01T08:00', { novo: true, agora })).toMatch(/dura 365 dias/);
  });
  it('sem início, ou data inválida, nada', () => {
    expect(avisoDeDatas('', '', { novo: true, agora })).toBeNull();
    expect(avisoDeDatas('xx', null, { novo: true, agora })).toBeNull();
  });
});

describe('as unidades do formulário (13/11/2026)', () => {
  const base = { isMarketing: false, permissionLevel: 'gestor_unidade', unit: 'DIC', delegatedUnits: [] as string[] };
  it('a gestora: a dela e as delegadas', () => {
    expect(unidadesNoFormulario(base)).toEqual(['DIC']);
    expect(unidadesNoFormulario({ ...base, delegatedUnits: ['Nilópolis'] })).toEqual(['DIC', 'Nilópolis']);
  });
  it('a unidade atual do evento sempre aparece', () => {
    expect(unidadesNoFormulario({ ...base, atual: 'Santana' })).toEqual(['DIC', 'Santana']);
    expect(unidadesNoFormulario({ ...base, atual: 'Grupo ANA Brasil' })).toEqual(['DIC', 'Grupo ANA Brasil']);
  });
  it('a comunicação: todas e o Grupo; os demais, as quatro', () => {
    expect(unidadesNoFormulario({ ...base, isMarketing: true })).toContain('Grupo ANA Brasil');
    expect(unidadesNoFormulario({ ...base, permissionLevel: 'eventos_parceiros', unit: 'Administração' })).toEqual(['DIC', 'Nilópolis', 'Santana', 'Administração']);
  });
});

describe('a locação só acima do teto (13/11/2026)', () => {
  const e = { transport_needed: true, transport_vehicle: '' as const, transport_external_support: true, marketing_request: false };
  it('com 30, vale: o veículo da ANA é opcional', () => {
    expect(locacaoPedida({ ...e, transport_passengers: 30 })).toBe(true);
    expect(errosDeTransporte({ ...e, transport_passengers: 30 }).transport_vehicle).toBeUndefined();
  });
  it('corrigido para 20, o "ligado" esquecido não conta: pede o veículo', () => {
    expect(locacaoPedida({ ...e, transport_passengers: 20 })).toBe(false);
    expect(errosDeTransporte({ ...e, transport_passengers: 20 }).transport_vehicle).toMatch(/escolha o veículo/i);
    expect(resumoDoTransporte({ ...e, transport_passengers: 20 })?.apoioExterno).toBe(false);
  });
});
