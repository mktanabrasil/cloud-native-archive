import { describe, expect, it } from 'vitest';
import { BOND_RULES } from '@/types';
import { UNIDADES_DA_EDUCACAO, unidadesDoPainel } from './unidades';

/** Os vínculos do Semanário no Painel (17/11/2026). */
describe('as unidades do Painel', () => {
  it('professora e orientadora: usuário padrão, numa unidade da Educação', () => {
    expect(BOND_RULES.professora).toEqual({ permission_level: 'usuario_padrao', unitMode: 'educacao' });
    expect(BOND_RULES.orientacao_pedagogica).toEqual({ permission_level: 'usuario_padrao', unitMode: 'educacao' });
  });

  it('na Educação, o seletor oferece os CEIs e o GOE, com o nome inteiro', () => {
    const lista = unidadesDoPainel('educacao', 'usuario_padrao');
    expect(lista).toBe(UNIDADES_DA_EDUCACAO);
    expect(lista[0]).toEqual({ valor: 'GOE', rotulo: 'Grupo de Oração Esperança' });
    expect(lista.map(u => u.valor)).toContain('Anísio');
    expect(lista.map(u => u.valor)).not.toContain('DIC');
  });

  it('os outros vínculos continuam como antes', () => {
    expect(unidadesDoPainel('fixed-admin', 'gestor_unidade').map(u => u.valor)).toEqual(['Administração']);
    expect(unidadesDoPainel('choose', 'usuario_padrao').map(u => u.valor)).toEqual(['DIC', 'Nilópolis', 'Santana']);
    expect(unidadesDoPainel(undefined, 'usuario_padrao').map(u => u.valor)).toEqual(['DIC', 'Nilópolis', 'Santana', 'Administração']);
  });
});
