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
  const professora = { temCalendario: false, canAccessJournal: false, temSemanario: true, temRh: false, temVoluntariado: false };
  const gestao = { temCalendario: false, canAccessJournal: true, temSemanario: false, temRh: false, temVoluntariado: false };
  const marketing = { temCalendario: true, canAccessJournal: true, temSemanario: true, temRh: true, temVoluntariado: true };

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

describe('Administração › Voluntariado (18/11/2026, PR 4)', () => {
  const nada = { temCalendario: false, canAccessJournal: false, temSemanario: false };
  it('o vínculo Voluntariado vê a Administração e entra direto no Voluntariado', () => {
    expect(setoresVisiveis({ isAuthenticated: true, temVoluntariado: true }).map(i => i.label)).toContain('Administração');
    const so = { ...nada, temRh: false, temVoluntariado: true };
    expect(paginasVisiveis(ROTAS.rh, so).map(p => p.rotulo)).toEqual(['Voluntariado']);
    expect(destinoDoSetor(ROTAS.rh, so)).toBe(ROTAS.voluntariado);
  });
  it('o RH não vê o Voluntariado; quem tem os dois vê as duas páginas e entra pelo RH', () => {
    const rh = { ...nada, temRh: true, temVoluntariado: false };
    expect(paginasVisiveis(ROTAS.rh, rh).map(p => p.rotulo)).toEqual(['RH']);
    expect(destinoDoSetor(ROTAS.rh, rh)).toBe(ROTAS.rh);
    const ambos = { ...nada, temRh: true, temVoluntariado: true };
    expect(paginasVisiveis(ROTAS.rh, ambos).map(p => p.rotulo)).toEqual(['RH', 'Voluntariado']);
    expect(destinoDoSetor(ROTAS.rh, ambos)).toBe(ROTAS.rh);
  });
  it('a página conta como do setor Administração', () => {
    expect(setorDoCaminho(ROTAS.voluntariado)).toBe(ROTAS.rh);
  });
});

describe('Administração › Financeiro, Padrinhos e Parceiros (18/11/2026, PR 6)', () => {
  const nada = { temCalendario: false, canAccessJournal: false, temSemanario: false, temRh: false, temVoluntariado: false };
  it('o financeiro vê a Administração e entra pelo Financeiro; vê também Padrinhos e Parceiros', () => {
    expect(setoresVisiveis({ isAuthenticated: true, temFinanceiro: true }).map(i => i.label)).toContain('Administração');
    const fin = { ...nada, temFinanceiro: true, temApoiadores: true };
    expect(paginasVisiveis(ROTAS.rh, fin).map(p => p.rotulo)).toEqual(['Financeiro', 'Padrinhos', 'Parceiros']);
    expect(destinoDoSetor(ROTAS.rh, fin)).toBe(ROTAS.financeiro);
  });
  it('o responsável liberado pelo e-mail vê só Padrinhos e Parceiros', () => {
    expect(setoresVisiveis({ isAuthenticated: true, temApoiadores: true }).map(i => i.label)).toContain('Administração');
    const resp = { ...nada, temApoiadores: true };
    expect(paginasVisiveis(ROTAS.rh, resp).map(p => p.rotulo)).toEqual(['Padrinhos', 'Parceiros']);
    expect(destinoDoSetor(ROTAS.rh, resp)).toBe(ROTAS.padrinhos);
  });
  it('o marketing vê as cinco, na ordem', () => {
    const mkt = { temCalendario: true, canAccessJournal: true, temSemanario: true, temRh: true, temVoluntariado: true, temFinanceiro: true, temApoiadores: true };
    expect(paginasVisiveis(ROTAS.rh, mkt).map(p => p.rotulo)).toEqual(['RH', 'Voluntariado', 'Financeiro', 'Padrinhos', 'Parceiros']);
    expect(setorDoCaminho(ROTAS.parceiros)).toBe(ROTAS.rh);
  });
});
