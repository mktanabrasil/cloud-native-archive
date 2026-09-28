import { describe, expect, it } from 'vitest';
import { fraseDaVaga, iconeDaVaga } from './icones';
import { SEMENTE } from './semente';

describe('ícone do trabalho', () => {
  it('sai do título, o mais específico primeiro', () => {
    expect(iconeDaVaga('Educador Social de Música', 'social')).toEqual({ icone: 'music', movimento: 'danca' });
    expect(iconeDaVaga('Professor de Educação Infantil · Educação Especial', 'educacao').icone).toBe('book-open');
    expect(iconeDaVaga('Auxiliar de Cozinha', 'educacao').icone).toBe('chef-hat');
    expect(iconeDaVaga('Auxiliar de Serviços Gerais', 'educacao').icone).toBe('wrench');
    expect(iconeDaVaga('Jovem Aprendiz', 'social')).toEqual({ icone: 'graduation-cap', movimento: 'joga' });
  });

  it('sem palavra conhecida, fica o ícone da área', () => {
    expect(iconeDaVaga('Vaga nova', 'administracao').icone).toBe('briefcase');
  });

  it('as 42 vagas do site têm ícone próprio, não o da área por falta de regra', () => {
    const semRegra = SEMENTE.filter(s => {
      const { icone } = iconeDaVaga(s.titulo, s.area);
      return icone === ({ social: 'users', educacao: 'book-open', administracao: 'briefcase' } as const)[s.area] && !/educador social|professor|recursos humanos|agente|mundo do trabalho/i.test(s.titulo);
    }).map(s => s.titulo);
    expect(semRegra).toEqual([]);
  });
});

describe('frase da faixa', () => {
  it('primeira frase da descrição; sem descrição, o primeiro requisito', () => {
    expect(fraseDaVaga('Oficinas de música com crianças. Trabalho em equipe.', [])).toBe('Oficinas de música com crianças.');
    expect(fraseDaVaga('', ['Ensino Médio completo', 'CNH'])).toBe('Requisito: Ensino Médio completo');
    expect(fraseDaVaga('', [])).toBe('');
  });

  it('corta na palavra, com reticências', () => {
    const f = fraseDaVaga('', ['Pedagogia com habilitação em Educação Especial; ou Pedagogia com especialização, mestrado ou doutorado']);
    expect(f.length).toBeLessThanOrEqual(73);
    expect(f.endsWith('…')).toBe(true);
    expect(f).not.toMatch(/ …$/);
  });
});
