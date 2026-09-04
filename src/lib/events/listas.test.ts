import { describe, expect, it } from 'vitest';
import { errosDasListas, limparListas } from './listas';

describe('errosDasListas', () => {
  it('desligado, nada a cobrar', () => {
    expect(errosDasListas({ partner_involved: false, has_unit_collaboration: false })).toEqual({});
  });

  it('parceiro ligado sem ninguém, ou só com linha em branco', () => {
    expect(errosDasListas({ partner_involved: true, partners: [] }).partners).toMatch(/ao menos um parceiro/);
    expect(errosDasListas({ partner_involved: true, partners: [{ type: '', name: '' }] }).partners).toMatch(/ao menos um parceiro/);
  });

  it('um preenchido e um em branco aponta a linha', () => {
    const r = errosDasListas({ partner_involved: true, partners: [{ type: 'empresa', name: 'Luxótica' }, { type: '', name: '' }] });
    expect(r.partners).toMatch(/remova a linha em branco/);
  });

  it('nome sem tipo também conta como incompleto', () => {
    expect(errosDasListas({ partner_involved: true, partners: [{ type: '', name: 'Luxótica' }] }).partners).toMatch(/ao menos um parceiro/);
  });

  it('parceria ligada sem unidade nem instituição', () => {
    const r = errosDasListas({ has_unit_collaboration: true, collaborating_units: [], external_collaborators: [] });
    expect(r.external_collaborators).toMatch(/marque uma unidade ou adicione uma instituição/i);
  });

  it('instituição em branco é apontada — ela iria para o site', () => {
    const r = errosDasListas({ has_unit_collaboration: true, collaborating_units: ['Santana'], external_collaborators: [{ name: ' ', details: '' }] });
    expect(r.external_collaborators).toMatch(/escreva o nome da instituição/i);
  });

  it('só unidade marcada basta', () => {
    expect(errosDasListas({ has_unit_collaboration: true, collaborating_units: ['DIC'], external_collaborators: [] })).toEqual({});
  });
});

describe('limparListas', () => {
  it('descarta o que está em branco e apara o resto', () => {
    const r = limparListas({
      partners: [{ type: 'empresa', name: '  Luxótica ' }, { type: '', name: '' }, { type: 'doador', name: '   ' }],
      external_collaborators: ['  Igreja do Nazareno ', { name: '', details: 'x' }, { name: ' ESPRO ', details: ' cursos ' }],
    });
    expect(r.partners).toEqual([{ type: 'empresa', name: 'Luxótica' }]);
    expect(r.external_collaborators).toEqual([
      { name: 'Igreja do Nazareno', details: '' },
      { name: 'ESPRO', details: 'cursos' },
    ]);
  });
});
