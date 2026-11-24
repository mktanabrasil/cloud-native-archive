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

describe('Gestão Educação (24/11/2026)', () => {
  it('a direção do CEI: gestor numa unidade da Educação, no grupo da Educação', async () => {
    const { BOND_GROUPS, BOND_LABELS } = await import('@/types');
    expect(BOND_RULES.gestao_educacao).toEqual({ permission_level: 'gestor_unidade', unitMode: 'educacao' });
    expect(BOND_LABELS.gestao_educacao).toBe('Gestão Educação');
    expect(BOND_GROUPS.find((g) => g.label.includes('Educação'))?.options[0]).toBe('gestao_educacao');
  });
});
