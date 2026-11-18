import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/**
 * Administração › RH (18/11/2026): a gestão das vagas que até aqui ficava em
 * /vagas. As abas são as de sempre; quem não é RH nem responsável volta ao portal.
 */
const espiao = vi.hoisted(() => ({ rh: false, admin: false, carregando: false, responsavel: false, respostaChegou: true }));

vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isRh: espiao.rh, isAdmin: espiao.admin, loading: espiao.carregando }) }));
vi.mock('@/hooks/useSouResponsavel', () => ({
  useResponsavel: () => ({ sou: espiao.responsavel, carregado: espiao.respostaChegou }),
  useSouResponsavel: () => espiao.responsavel,
}));
vi.mock('@/components/vagas/PainelDoRh', () => ({ PainelDoRh: () => <p>painel do rh</p> }));
vi.mock('@/components/vagas/ProcessosDoRh', () => ({ ProcessosDoRh: () => <p>processos do rh</p> }));
vi.mock('@/components/vagas/GestaoDeVagas', () => ({ GestaoDeVagas: () => <p>painel da gestão</p> }));
vi.mock('@/components/vagas/RelatoriosDoRh', () => ({ RelatoriosDoRh: () => <p>relatórios do rh</p> }));
vi.mock('@/components/vagas/ModelosDeEmail', () => ({ ModelosDeEmail: () => <p>modelos de e-mail</p> }));
vi.mock('@/components/vagas/AuditoriaDasVagas', () => ({ AuditoriaDasVagas: () => <p>auditoria das vagas</p> }));
vi.mock('@/components/vagas/MeusProcessos', () => ({ MeusProcessos: () => <p>meus processos</p> }));

const { default: AdministracaoRhPage } = await import('./AdministracaoRhPage');

function Onde() {
  const l = useLocation();
  return <p data-testid="onde">{l.pathname}{l.search}</p>;
}
const abrir = (url = '/administracao/rh') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/administracao/rh" element={<><AdministracaoRhPage /><Onde /></>} />
      <Route path="/vagas" element={<p>o portal</p>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  espiao.rh = false; espiao.admin = false; espiao.carregando = false; espiao.responsavel = false; espiao.respostaChegou = true;
});

describe('Administração › RH', () => {
  it('o RH abre no Painel e troca de aba pelo ?tela=', () => {
    espiao.rh = true;
    abrir();
    expect(screen.getByText('painel do rh')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gestão' }));
    expect(screen.getByText('painel da gestão')).toBeInTheDocument();
    expect(screen.getByTestId('onde')).toHaveTextContent('/administracao/rh?tela=gestao');
    fireEvent.click(screen.getByRole('button', { name: 'Painel' }));
    expect(screen.getByTestId('onde').textContent).toBe('/administracao/rh');
  });

  it('Relatórios e Modelos de e-mail são do RH; Auditoria só do administrador', () => {
    espiao.rh = true;
    const { unmount } = abrir('/administracao/rh?tela=auditoria');
    expect(screen.getByText('painel do rh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Auditoria' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Relatórios' }));
    expect(screen.getByText('relatórios do rh')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modelos de e-mail' }));
    expect(screen.getByText('modelos de e-mail')).toBeInTheDocument();
    unmount();

    espiao.admin = true;
    abrir('/administracao/rh?tela=auditoria');
    expect(screen.getByText('auditoria das vagas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auditoria' })).toHaveAttribute('aria-current', 'page');
  });

  it('o portal fica a um link', () => {
    espiao.rh = true;
    abrir();
    expect(screen.getByRole('link', { name: /Ver o portal/ })).toHaveAttribute('href', '/vagas?tela=portal');
  });

  it('o responsável, sem ser RH, vê só Meus processos, sem abas', () => {
    espiao.responsavel = true;
    abrir('/administracao/rh?tela=gestao');
    expect(screen.getByText('meus processos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gestão' })).not.toBeInTheDocument();
  });

  it('enquanto o papel carrega, não mostra nada nem manda ao portal (a aba pedida não se perde)', () => {
    espiao.carregando = true;
    abrir('/administracao/rh?tela=gestao');
    expect(screen.queryByText('o portal')).not.toBeInTheDocument();
    expect(screen.queryByText('painel da gestão')).not.toBeInTheDocument();
    expect(screen.getByTestId('onde')).toHaveTextContent('/administracao/rh?tela=gestao');
  });

  it('quem não é RH nem responsável volta ao portal, mas só depois da resposta', () => {
    espiao.respostaChegou = false;
    const { unmount } = abrir();
    expect(screen.queryByText('o portal')).not.toBeInTheDocument();
    expect(screen.queryByText('meus processos')).not.toBeInTheDocument();
    unmount();

    espiao.respostaChegou = true;
    abrir();
    expect(screen.getByText('o portal')).toBeInTheDocument();
  });
});
