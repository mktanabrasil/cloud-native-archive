import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const espiao = vi.hoisted(() => ({
  usuario: null as null | { email: string; user_metadata: Record<string, unknown> },
  criadas: [] as unknown[][],
  entradas: [] as unknown[][],
  pedidos: [] as string[],
  erroAoCriar: null as null | Error,
  usuarioAoEntrar: { email: 'leo@exemplo.com', user_metadata: { conta: 'candidato', name: 'Leonardo' } } as { email: string; user_metadata: Record<string, unknown> },
  saidas: 0,
}));

// O Checkbox do Radix mede o próprio tamanho; o jsdom não tem ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const avisos = vi.hoisted(() => ({ info: [] as string[] }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: (t: string) => { avisos.info.push(t); } } }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isRh: false }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: espiao.usuario, isAuthenticated: espiao.usuario !== null, loading: false, signOut: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signOut: async () => { espiao.saidas++; } } } }));
vi.mock('@/lib/vagas/conta', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/conta')>('@/lib/vagas/conta');
  return {
    ...real,
    criarContaDeCandidato: async (...a: unknown[]) => { espiao.criadas.push(a); if (espiao.erroAoCriar) throw espiao.erroAoCriar; return { precisaConfirmar: false }; },
    entrarComoCandidato: async (...a: unknown[]) => { espiao.entradas.push(a); return espiao.usuarioAoEntrar; },
    pedirNovaSenha: async (email: string) => { espiao.pedidos.push(email); },
  };
});

const { default: CriarConta } = await import('./CriarContaCandidatoPage');
const { default: Entrar } = await import('./EntrarCandidatoPage');
const { default: Recuperar } = await import('./RecuperarSenhaCandidatoPage');
const { default: MinhaArea } = await import('./MinhaAreaCandidatoPage');

const abrir = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/vagas/criar-conta" element={<CriarConta />} />
      <Route path="/vagas/entrar" element={<Entrar />} />
      <Route path="/vagas/recuperar-senha" element={<Recuperar />} />
      <Route path="/vagas/minha-area" element={<MinhaArea />} />
      <Route path="/login" element={<p>Login da equipe</p>} />
      <Route path="/" element={<p>app da equipe</p>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  espiao.usuario = null; espiao.criadas = []; espiao.entradas = []; espiao.pedidos = []; espiao.erroAoCriar = null; espiao.saidas = 0;
  espiao.usuarioAoEntrar = { email: 'leo@exemplo.com', user_metadata: { conta: 'candidato', name: 'Leonardo' } };
});

const responder = (valor: string) => {
  fireEvent.change(screen.getByLabelText(/Como você quer ser chamado|Qual é o seu e-mail|Crie uma senha/), { target: { value: valor } });
  fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
};

describe('criar conta, uma pergunta por vez', () => {
  it('nome, e-mail, senha e aceite; no fim, "Bom voo"', async () => {
    abrir('/vagas/criar-conta');
    expect(screen.getByText('Criar conta · 1 de 3 · um minuto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escreva como você quer ser chamado.');

    responder('Leonardo');
    expect(screen.getByText('Criar conta · 2 de 3 · um minuto')).toBeInTheDocument();
    responder('leo@exemplo');
    expect(screen.getByRole('alert')).toHaveTextContent(/Confira o e-mail/);
    responder('leo@exemplo.com');
    responder('curta');
    expect(screen.getByRole('alert')).toHaveTextContent(/8 caracteres/);
    responder('voos2026mais');

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/marque que leu e aceita/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(espiao.criadas).toEqual([['Leonardo', 'leo@exemplo.com', 'voos2026mais']]));
    expect(await screen.findByText(/Bom voo, Leonardo!/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Minha área/ })).toHaveAttribute('href', '/vagas/minha-area');
  });

  it('e-mail já cadastrado volta para a pergunta do e-mail, com o aviso', async () => {
    espiao.erroAoCriar = new Error('User already registered');
    abrir('/vagas/criar-conta');
    responder('Ana'); responder('ana@exemplo.com'); responder('voos2026mais');
    fireEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Já existe uma conta com esse e-mail/);
    expect(screen.getByLabelText('Qual é o seu e-mail?')).toHaveValue('ana@exemplo.com');
  });

  it('Voltar mantém o que já foi respondido', () => {
    abrir('/vagas/criar-conta');
    responder('Leonardo');
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(screen.getByLabelText('Como você quer ser chamado?')).toHaveValue('Leonardo');
  });
});

describe('entrar', () => {
  it('candidato entra e vai para a área dele', async () => {
    abrir('/vagas/entrar');
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'leo@exemplo.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'voos2026mais' } });
    fireEvent.click(screen.getByRole('button', { name: /^Entrar/ }));
    await waitFor(() => expect(espiao.entradas).toEqual([['leo@exemplo.com', 'voos2026mais']]));
  });

  it('conta da equipe é mandada para o login da equipe, sem ficar logada aqui', async () => {
    espiao.usuarioAoEntrar = { email: 'mkt@anabrasil.org', user_metadata: { name: 'Equipe' } };
    abrir('/vagas/entrar');
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'mkt@anabrasil.org' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'qualquer1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Entrar/ }));
    // Vai direto para o login da equipe, com o aviso (09/10/2026: na porta de /vagas a mensagem sumia).
    expect(await screen.findByText('Login da equipe')).toBeInTheDocument();
    expect(espiao.saidas).toBe(1);
    expect(avisos.info).toEqual(['Essa é uma conta da equipe da ANA']);
  });
});

describe('recuperar senha', () => {
  it('responde igual exista a conta ou não', async () => {
    abrir('/vagas/recuperar-senha');
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'quem@exemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Se quem@exemplo.com tiver conta/);
    expect(espiao.pedidos).toEqual(['quem@exemplo.com']);
  });
});

describe('minha área', () => {
  it('sem sessão, vai para o login e volta depois', () => {
    abrir('/vagas/minha-area');
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('candidato é recebido pelo primeiro nome', () => {
    espiao.usuario = { email: 'leo@exemplo.com', user_metadata: { conta: 'candidato', name: 'Leonardo Garbo' } };
    abrir('/vagas/minha-area');
    expect(screen.getByRole('heading', { name: 'Olá, Leonardo.' })).toBeInTheDocument();
  });

  it('conta da equipe não entra na área do candidato', () => {
    espiao.usuario = { email: 'mkt@anabrasil.org', user_metadata: { name: 'Equipe' } };
    abrir('/vagas/minha-area');
    expect(screen.getByText('app da equipe')).toBeInTheDocument();
  });
});
