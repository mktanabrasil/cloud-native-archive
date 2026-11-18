import { describe, expect, it } from 'vitest';
import { REDIRECIONAMENTOS, ROTAS, destinoDoSetor, navItems, paginasVisiveis, setorDoCaminho, setoresVisiveis } from './navigation';

describe('menu de cima', () => {
  it('a Administração (era "Vagas") é só de RH, admin e responsável, e abre no RH (18/11/2026)', () => {
    const adm = navItems.find(i => i.label === 'Administração');
    expect(adm).toMatchObject({ to: ROTAS.rh, requireAuth: true, rhOnly: true });
    expect(adm?.hidden).toBeFalsy();
    expect(navItems.some(i => i.label === 'Vagas' || i.to === '/vagas')).toBe(false);
    expect(setoresVisiveis({ isAuthenticated: true }).map(i => i.label)).not.toContain('Administração');
    expect(setoresVisiveis({ isAuthenticated: true, isRh: true }).map(i => i.label)).toContain('Administração');
    expect(setoresVisiveis({ isAuthenticated: true, souResponsavel: true }).map(i => i.label)).toContain('Administração');
    expect(setorDoCaminho(ROTAS.rh)).toBe(ROTAS.rh);
    expect(REDIRECIONAMENTOS['/administracao']).toBe(ROTAS.rh);
  });
});

describe('a Educação e o Semanário (17/11/2026)', () => {
  const professora = { temCalendario: false, canAccessJournal: false, temSemanario: true };
  const gestao = { temCalendario: false, canAccessJournal: true, temSemanario: false };
  const marketing = { temCalendario: true, canAccessJournal: true, temSemanario: true };

  it('a professora vê o setor Educação, sem o Social, e ele leva ao Semanário', () => {
    const setores = setoresVisiveis({ isAuthenticated: true, soEducacao: true, temSemanario: true }).map(i => i.label);
    expect(setores).toEqual(['Educação']);
    expect(destinoDoSetor(ROTAS.jornal, professora)).toBe(ROTAS.semanario);
    expect(paginasVisiveis(ROTAS.jornal, professora).map(p => p.rotulo)).toEqual(['Semanário']);
  });

  it('a gestão da Educação continua entrando pelo Jornal e não vê o Semanário', () => {
    expect(destinoDoSetor(ROTAS.jornal, gestao)).toBe(ROTAS.jornal);
    expect(paginasVisiveis(ROTAS.jornal, gestao).map(p => p.rotulo)).toEqual(['Jornal Institucional', 'Jornais das unidades']);
  });

  it('o marketing vê as três páginas; os outros setores não mudam de destino', () => {
    expect(paginasVisiveis(ROTAS.jornal, marketing).map(p => p.rotulo)).toEqual(['Jornal Institucional', 'Jornais das unidades', 'Semanário']);
    expect(destinoDoSetor(ROTAS.marketing, marketing)).toBe(ROTAS.marketing);
    expect(destinoDoSetor(ROTAS.eventos, marketing)).toBe(ROTAS.eventos);
    expect(destinoDoSetor('/vagas', marketing)).toBe('/vagas');
  });

  it('a ficha de um semanário conta como a página aberta', () => {
    const semanario = paginasVisiveis(ROTAS.jornal, marketing).find(p => p.rotulo === 'Semanário')!;
    expect(semanario.aberta('/educacao/semanario/abc')).toBe(true);
    expect(semanario.aberta('/educacao/jornal')).toBe(false);
  });
});
