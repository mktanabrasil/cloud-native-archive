import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/**
 * `app.anabrasil.org` (17/11/2026): a página inicial para quem está logado;
 * o resto do que a raiz já fazia fica com o hub dos Eventos.
 */
const estado = vi.hoisted(() => ({ auth: { isAuthenticated: true, user: { id: 'e1', user_metadata: {} } as unknown }, limpa: false, papel: { soSemanario: false, loading: false } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.auth }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => estado.papel }));
vi.mock('@/hooks/useIsEntryGate', () => ({ useIsCleanView: () => estado.limpa }));
vi.mock('@/pages/EventsHubPage', () => ({ default: () => <p>hub dos eventos</p> }));
vi.mock('@/pages/InicioPage', () => ({ default: () => <p>página inicial</p> }));

const { default: RaizPage } = await import('./RaizPage');
function Endereco() {
  const l = useLocation();
  return <p data-testid="endereco">{l.pathname + l.search}</p>;
}
const abrir = (url = '/') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<RaizPage />} />
        <Route path="*" element={<p>outra página</p>} />
      </Routes>
      <Endereco />
    </MemoryRouter>,
  );

afterEach(() => {
  estado.auth = { isAuthenticated: true, user: { id: 'e1', user_metadata: {} } };
  estado.limpa = false;
  estado.papel = { soSemanario: false, loading: false };
});

describe('a raiz', () => {
  it('a professora e a orientadora vão direto ao Semanário (17/11/2026)', () => {
    estado.papel = { soSemanario: true, loading: false };
    abrir();
    expect(screen.getByTestId('endereco')).toHaveTextContent('/educacao/semanario');
  });

  it('enquanto o papel carrega, a raiz espera', () => {
    estado.papel = { soSemanario: false, loading: true };
    abrir();
    expect(screen.queryByText('página inicial')).not.toBeInTheDocument();
  });

  it('quem está logado vê a página inicial', () => {
    abrir();
    expect(screen.getByText('página inicial')).toBeInTheDocument();
  });

  it('sem sessão, o hub (que mostra a porta de entrada)', () => {
    estado.auth = { isAuthenticated: false, user: null };
    abrir();
    expect(screen.getByText('hub dos eventos')).toBeInTheDocument();
  });

  it('no embed do site, o hub, como sempre', () => {
    estado.limpa = true;
    abrir('/?embed=true');
    expect(screen.getByText('hub dos eventos')).toBeInTheDocument();
  });

  it('a volta do Google (agenda e Drive) fica com o hub, que a encaminha', () => {
    abrir('/?code=x&state=agenda:1');
    expect(screen.getByText('hub dos eventos')).toBeInTheDocument();
  });

  it('conta de candidato ou do Calendário Anual: o hub, que desvia', () => {
    estado.auth = { isAuthenticated: true, user: { id: 'k1', user_metadata: { conta: 'calendario' } } };
    abrir();
    expect(screen.getByText('hub dos eventos')).toBeInTheDocument();
  });

  it.each(['/?tela=calendario', '/?slug=natal-feliz', '/?aba=passados'])('o link antigo %s segue para os Eventos', (url) => {
    abrir(url);
    expect(screen.getByTestId('endereco')).toHaveTextContent(`/social/eventos${url.slice(1)}`);
  });
});
