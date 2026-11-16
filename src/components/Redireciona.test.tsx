import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketingSemAba, Redireciona } from './Redireciona';
import { REDIRECIONAMENTOS, navItems, PAGINAS_DOS_SETORES } from '@/config/navigation';

/**
 * Endereços por setor (16/11/2026): os de antes continuam abrindo e levam aos
 * novos. Há links antigos em e-mails que já saíram (`/?tela=calendario`), no
 * e-mail das gestoras (`/calendario`) e nos favoritos de quem usa o app.
 */
function Endereco() {
  const l = useLocation();
  return <p data-testid="endereco">{l.pathname + l.search + l.hash}</p>;
}
const abrir = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        {Object.entries(REDIRECIONAMENTOS).map(([antigo, novo]) => (
          <Route key={antigo} path={antigo} element={<Redireciona para={novo} />} />
        ))}
        <Route path="/marketing" element={<MarketingSemAba />} />
        <Route path="*" element={<Endereco />} />
      </Routes>
    </MemoryRouter>,
  );
const endereco = () => screen.getByTestId('endereco').textContent;

describe('os endereços de antes', () => {
  it.each([
    ['/jornal-institucional', '/educacao/jornal'],
    ['/jornais-das-unidades', '/educacao/jornais-das-unidades'],
    ['/calendario', '/social/calendario'],
    ['/usuarios', '/painel'],
    ['/mercado-solidario', '/marketing/mercado-solidario'],
    ['/auditoria', '/marketing/auditoria'],
    ['/design-manual', '/marketing/design-manual'],
    ['/admin-toolbox', '/marketing/widgets'],
    ['/visao-geral', '/social/eventos?tela=visao-geral'],
    ['/social', '/social/eventos'],
    ['/educacao', '/educacao/jornal'],
  ])('%s leva a %s', (antigo, novo) => {
    abrir(antigo);
    expect(endereco()).toBe(novo);
  });

  it('o resto do link vai junto: a unidade do Jornal e a aba do Painel', () => {
    abrir('/jornal-institucional?unidade=cei-calmon');
    expect(endereco()).toBe('/educacao/jornal?unidade=cei-calmon');
  });

  it('o Painel abre na aba do link (a volta da conexão com a agenda)', () => {
    abrir('/usuarios?tab=agenda&code=x');
    expect(endereco()).toBe('/painel?tab=agenda&code=x');
  });

  it('a volta do Google no Portal da Transparência chega à aba, com o código', () => {
    abrir('/portal-transparencia?type=google_connect&code=abc');
    expect(endereco()).toBe('/marketing/transparencia?type=google_connect&code=abc');
  });

  it('a confirmação de e-mail do Calendário Anual chega com a sessão (o #)', () => {
    abrir('/calendario#access_token=t&type=signup');
    expect(endereco()).toBe('/social/calendario#access_token=t&type=signup');
  });
});

describe('o Marketing', () => {
  it.each([
    ['/marketing', '/marketing/auditoria'],
    ['/marketing?aba=pizza', '/marketing/pizza'],
    ['/marketing?aba=voluntariado', '/marketing/voluntariado'],
    ['/marketing?aba=nao-existe', '/marketing/auditoria'],
    ['/marketing?aba=enquetes&x=1', '/marketing/enquetes?x=1'],
  ])('%s leva a %s', (antigo, novo) => {
    abrir(antigo);
    expect(endereco()).toBe(novo);
  });
});

describe('o mapa', () => {
  it('nenhum link do menu ou da faixa aponta para um endereço de antes', () => {
    const links = [...navItems.map((i) => i.to), ...Object.values(PAGINAS_DOS_SETORES).flat().map((p) => p.to)];
    for (const link of links) expect(Object.keys(REDIRECIONAMENTOS), link).not.toContain(link.split('?')[0]);
  });

  it('as páginas públicas não estão entre os endereços que mudaram', () => {
    for (const publico of ['/', '/eventos', '/vagas', '/mercado-solidario-publico', '/portal-transparencia-publico', '/pizza-da-alegria', '/voluntariado', '/enquete']) {
      expect(Object.keys(REDIRECIONAMENTOS)).not.toContain(publico);
    }
  });
});
