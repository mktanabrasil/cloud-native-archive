import { describe, expect, it } from 'vitest';
import { GRUPO, eventoNaUnidade } from './grupo';

describe('Grupo ANA Brasil (11/11/2026)', () => {
  it('o evento do Grupo entra no filtro de DIC, Nilópolis e Santana, e no dele', () => {
    for (const u of ['DIC', 'Nilópolis', 'Santana', GRUPO]) expect(eventoNaUnidade(GRUPO, u)).toBe(true);
  });

  it('não entra no da Administração; e os das unidades seguem só na sua', () => {
    expect(eventoNaUnidade(GRUPO, 'Administração')).toBe(false);
    expect(eventoNaUnidade('DIC', 'DIC')).toBe(true);
    expect(eventoNaUnidade('DIC', 'Santana')).toBe(false);
    expect(eventoNaUnidade('DIC', GRUPO)).toBe(false);
  });
});
