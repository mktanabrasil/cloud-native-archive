import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { EventoComApoiadores } from '@/lib/administracao/apoiadores';

/** Administração › Padrinhos e Parceiros (18/11/2026, PR 6). */
const espiao = vi.hoisted(() => ({
  vejo: true, admin: false, falha: false,
  eventos: [] as EventoComApoiadores[],
  acesso: [] as string[],
  mudancas: [] as [string, boolean][],
}));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isAdmin: espiao.admin, loading: false }) }));
vi.mock('@/hooks/useApoiadores', () => ({ useApoiadores: () => ({ vejo: espiao.vejo, carregado: true }) }));
vi.mock('@/hooks/useTituloDaAba', () => ({ useTituloDaAba: () => {} }));
vi.mock('@/lib/administracao/apoiadoresApi', () => ({
  lerApoiadores: vi.fn(async () => { if (espiao.falha) throw Object.assign(new Error('semBanco'), { semBanco: true }); return espiao.eventos; }),
  lerAcesso: vi.fn(async () => espiao.acesso.map(email => ({ email, adicionado_em: '2026-11-18T12:00:00Z', adicionado_por: 'MKT' }))),
  mudarAcesso: vi.fn(async (email: string, liberar: boolean) => {
    espiao.mudancas.push([email, liberar]);
    espiao.acesso = liberar ? [...espiao.acesso, email] : espiao.acesso.filter(e => e !== email);
  }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: Pagina } = await import('./AdministracaoApoiadoresPage');

const ev = (o: Partial<EventoComApoiadores>): EventoComApoiadores => ({
  id: 'e', title: 'Evento', unit: 'DIC', start_datetime: '2026-11-20T12:00:00Z', end_datetime: null, status: 'confirmado',
  partners: [], partner_type: null, partner_name: null, external_collaborators: [], ...o,
});
const abrir = (lado: 'padrinhos' | 'parceiros') => render(
  <MemoryRouter initialEntries={['/administracao/x']}>
    <Routes>
      <Route path="/administracao/x" element={<Pagina lado={lado} />} />
      <Route path="/" element={<p>início</p>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  espiao.vejo = true; espiao.admin = false; espiao.falha = false; espiao.acesso = []; espiao.mudancas = [];
  espiao.eventos = [
    ev({ id: 'a', title: 'Festa das famílias', partners: [{ type: 'padrinho', name: 'José Lima' }, { type: 'empresa', name: 'Padaria Sol' }] }),
    ev({ id: 'b', title: 'Natal Feliz', unit: 'Grupo ANA Brasil', status: 'pendente', start_datetime: '2026-12-08T12:00:00Z', partners: [{ type: 'doador', name: 'Ana Doa' }], external_collaborators: ['CRAS Centro'] }),
  ];
});

describe('Padrinhos', () => {
  it('lista os padrinhos e doadores com os eventos; pendente leva o selo', async () => {
    abrir('padrinhos');
    const tabela = await screen.findByRole('table');
    const linhas = within(tabela).getAllByRole('row').slice(1);
    expect(linhas.map(l => l.querySelector('td')?.textContent)).toEqual(['Ana Doa', 'José Lima']);
    expect(linhas[0]).toHaveTextContent('aguardando aprovação');
    expect(screen.queryByText('Padaria Sol')).toBeNull();
  });

  it('filtra pelo tipo', async () => {
    abrir('padrinhos');
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: /^Padrinho/ }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
  });

  it('sem acesso, volta ao início', async () => {
    espiao.vejo = false;
    abrir('padrinhos');
    expect(await screen.findByText('início')).toBeInTheDocument();
  });

  it('sem o SQL, avisa em vez de quebrar', async () => {
    espiao.falha = true;
    abrir('padrinhos');
    expect(await screen.findByText(/ainda depende de uma atualização do banco/)).toBeInTheDocument();
  });
});

describe('Parceiros', () => {
  it('empresas e instituições', async () => {
    abrir('parceiros');
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getAllByRole('row').slice(1).map(l => l.querySelector('td')?.textContent)).toEqual(['CRAS Centro', 'Padaria Sol']);
  });
});

describe('quem mais vê', () => {
  it('só o admin vê a lista de acesso', async () => {
    abrir('padrinhos');
    await screen.findByRole('table');
    expect(screen.queryByLabelText('Quem mais vê Padrinhos e Parceiros')).toBeNull();
  });

  it('o admin libera e tira um e-mail', async () => {
    espiao.admin = true;
    abrir('padrinhos');
    const campo = await screen.findByLabelText('E-mail para liberar');
    fireEvent.change(campo, { target: { value: ' Resp@AnaBrasil.org ' } });
    fireEvent.click(screen.getByRole('button', { name: /Liberar/ }));
    await waitFor(() => expect(espiao.mudancas).toEqual([['resp@anabrasil.org', true]]));
    fireEvent.click(await screen.findByRole('button', { name: 'Tirar o acesso de resp@anabrasil.org' }));
    await waitFor(() => expect(espiao.mudancas).toContainEqual(['resp@anabrasil.org', false]));
  });
});
