import { describe, expect, it } from 'vitest';
import { navItems } from './navigation';

describe('menu de cima', () => {
  it('o atalho de Vagas existe e é só de RH e admin (25/09/2026)', () => {
    const vagas = navItems.find(i => i.to === '/vagas');
    expect(vagas).toMatchObject({ label: 'Vagas', requireAuth: true, rhOnly: true });
    expect(vagas?.hidden).toBeFalsy();
  });
});
