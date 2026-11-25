import { describe, expect, it } from 'vitest';
import { UNIDADES_DO_VOLUNTARIADO } from './modelo';

/** Os grupos da lista de unidades do voluntariado (25/11/2026). */
describe('grupos de unidades', () => {
  it('a Educação e, à parte, o Escritório (ADM) no grupo ANA Brasil', () => {
    expect(UNIDADES_DO_VOLUNTARIADO.map((g) => g.rotulo)).toEqual(['Educação', 'ANA Brasil']);
    expect(UNIDADES_DO_VOLUNTARIADO[0].unidades).toHaveLength(12);
    expect(UNIDADES_DO_VOLUNTARIADO[1].unidades.map((u) => u.name)).toEqual(['Escritório (ADM)']);
    expect(UNIDADES_DO_VOLUNTARIADO.map((g) => g.rotulo)).not.toContain('Social');
  });
});
