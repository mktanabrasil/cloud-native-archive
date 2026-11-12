import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/** A presença na entrada (13/11/2026): o leitor da credencial da Central do Voluntário. */

const e = vi.hoisted(() => ({
  logado: true,
  papel: { isMarketing: true, loading: false },
  lista: [] as Array<Record<string, unknown>>,
  presencas: [] as Array<Record<string, unknown>>,
  registros: [] as Array<[string, string]>,
  desfeitos: [] as Array<[string, string]>,
  resposta: null as unknown,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/ThemeToggle', () => ({ TemaFlutuante: () => null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: e.logado, loading: false, user: null }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => e.papel }));
vi.mock('@/lib/voluntariado/api', () => ({ listarInscricoes: async () => e.lista }));
vi.mock('@/lib/voluntariado/central', async (original) => ({
  ...(await original<typeof import('@/lib/voluntariado/central')>()),
  listarPresencas: async () => e.presencas,
  registrarPresenca: async (p: string, m: string) => { e.registros.push([p, m]); return e.resposta; },
  desfazerPresenca: async (p: string, m: string) => { e.desfeitos.push([p, m]); },
}));

const { default: Presenca } = await import('./VoluntariadoPresencaPage');

const V = { id: 'v1', protocolo: 'VL-7KQ2M', nome: 'Maria Souza', vinculo: 'funcionario', unidade_nome: 'GOE', horario: 'manha', opcao1: 'cozinha' };
const I = (o: Record<string, unknown>) => ({ id: 'v1', protocolo: 'VL-7KQ2M', nome: 'Maria Souza', whatsapp: '19990001111', vinculo: 'funcionario', horario: 'manha', unidade_id: 'goe', unidade_nome: 'GOE', area: 'educacao', indicado_por: null, igreja: null, como_soube: null, opcao1: 'cozinha', opcao2: null, created_at: '2026-11-05T15:00:00Z', ...o });

beforeEach(() => {
  e.logado = true; e.papel = { isMarketing: true, loading: false };
  e.lista = [I({}), I({ id: 'v2', protocolo: 'VL-4HN9R', nome: 'João Lima', vinculo: 'comunidade', unidade_nome: null, opcao1: 'inflaveis' })];
  e.presencas = []; e.registros = []; e.desfeitos = [];
  e.resposta = { status: 'registrada', momento: 'treinamento', registrado_em: '2026-11-28T12:05:00Z', voluntario: V };
});

const abrir = (url = '/voluntariado/natalfeliz26/presenca') => render(<MemoryRouter initialEntries={[url]}><Presenca /></MemoryRouter>);
const bipar = (texto: string) => {
  const campo = screen.getByRole('textbox', { name: 'Código da credencial ou nome' });
  fireEvent.change(campo, { target: { value: texto } });
  fireEvent.submit(campo.closest('form')!);
};

describe('presença com leitor', () => {
  it('o leitor digita o link do QR: registra no momento escolhido e mostra quem é', async () => {
    abrir();
    await screen.findByText(/de 2 presentes/);
    fireEvent.click(screen.getByRole('button', { name: /Treinamento · 28\/11/ }));
    bipar('https://app.anabrasil.org/voluntariado/natalfeliz26/presenca?p=VL-7KQ2M');
    const r = await screen.findByTestId('resultado');
    expect(r).toHaveAttribute('data-estado', 'registrada');
    expect(r).toHaveTextContent('Presença registrada');
    expect(r).toHaveTextContent('Maria Souza · VL-7KQ2M');
    expect(r).toHaveTextContent('Cozinha / Servimento · Manhã · GOE');
    expect(e.registros).toEqual([['VL-7KQ2M', 'treinamento']]);
    expect(within(screen.getByTestId('recentes')).getByText('Maria Souza')).toBeInTheDocument();
  });

  it('a mesma credencial de novo: avisa que já estava, com a hora', async () => {
    e.resposta = { status: 'ja_registrada', momento: 'evento', registrado_em: '2026-12-08T09:31:00Z', voluntario: V };
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: /Natal Feliz · 08\/12/ }));
    bipar('vl-7kq2m');
    const r = await screen.findByTestId('resultado');
    expect(r).toHaveAttribute('data-estado', 'ja_registrada');
    expect(r).toHaveTextContent('Registrada às 06:31');
    expect(e.registros).toEqual([['VL-7KQ2M', 'evento']]);
  });

  it('código que não é de inscrição', async () => {
    e.resposta = { status: 'nao_encontrado', protocolo: 'VL-ZZZZZ' };
    abrir();
    await screen.findByText(/de 2 presentes/);
    bipar('VL-ZZZZZ');
    expect(await screen.findByTestId('resultado')).toHaveTextContent('Credencial não encontrada');
  });

  it('sem leitor: procura pelo nome e registra com um toque; quem já está presente não tem botão', async () => {
    e.presencas = [{ voluntario_id: 'v2', momento: 'treinamento', registrado_em: '2026-11-28T12:00:00Z' }];
    abrir();
    await screen.findByText(/de 2 presentes/);
    fireEvent.click(screen.getByRole('button', { name: /Treinamento · 28\/11/ }));
    const campo = screen.getByRole('textbox', { name: 'Código da credencial ou nome' });
    fireEvent.change(campo, { target: { value: 'joao' } });
    const achados = await screen.findByTestId('achados');
    expect(achados).toHaveTextContent('João Lima');
    expect(achados).toHaveTextContent('Já presente');
    fireEvent.change(campo, { target: { value: 'maria' } });
    fireEvent.click(within(await screen.findByTestId('achados')).getByRole('button', { name: 'Registrar presença' }));
    await screen.findByTestId('resultado');
    expect(e.registros).toEqual([['VL-7KQ2M', 'treinamento']]);
  });

  it('desfazer tira a presença lida por engano', async () => {
    abrir();
    await screen.findByText(/de 2 presentes/);
    bipar('VL-7KQ2M');
    await screen.findByTestId('resultado');
    fireEvent.click(within(screen.getByTestId('recentes')).getByRole('button', { name: 'Desfazer' }));
    await screen.findByText(/As presenças registradas nesta tela aparecem aqui/);
    expect(e.desfeitos).toHaveLength(1);
  });

  it('pela câmera do celular (?p=): mostra quem é e pede um toque para registrar', async () => {
    abrir('/voluntariado/natalfeliz26/presenca?p=VL-7KQ2M');
    const caixa = await screen.findByTestId('do-link');
    expect(await within(caixa).findByText('Maria Souza')).toBeInTheDocument();
    expect(e.registros).toEqual([]);
    fireEvent.click(within(caixa).getByRole('button', { name: 'Registrar presença' }));
    await screen.findByTestId('resultado');
    expect(e.registros).toHaveLength(1);
  });
});

describe('acesso', () => {
  it('sem login: pede para entrar, mostrando o código lido', () => {
    e.logado = false;
    abrir('/voluntariado/natalfeliz26/presenca?p=VL-7KQ2M');
    expect(screen.getByText(/Esta é a credencial/)).toHaveTextContent('VL-7KQ2M');
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
  });
  it('logado sem ser da comunicação: não registra', () => {
    e.papel = { isMarketing: false, loading: false };
    abrir();
    expect(screen.getByText('A presença é registrada pela equipe de comunicação.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
