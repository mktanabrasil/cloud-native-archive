import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const banco = vi.hoisted(() => ({
  perfil: {} as Record<string, unknown>,
  exps: [] as Array<Record<string, unknown>>,
  salvos: [] as Array<Record<string, unknown>>,
  enviados: [] as Array<{ nome: string; anterior: string | null }>,
  removidos: [] as string[],
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'leo@exemplo.com', user_metadata: { conta: 'candidato', name: 'Leonardo' } }, isAuthenticated: true, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isRh: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/vagas/perfil', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/perfil')>('@/lib/vagas/perfil');
  return {
    ...real,
    carregarPerfil: async () => ({ perfil: real.paraPerfil({ ...banco.perfil }), experiencias: banco.exps.map((e) => ({ descricao: '', ...e })) }),
    salvarPerfil: async (_: string, campos: Record<string, unknown>) => { banco.salvos.push(campos); Object.assign(banco.perfil, campos); },
    salvarExperiencia: async (_: string, e: Record<string, unknown>) => ({ ...e, id: 'e1', fim: e.atual ? null : e.fim }),
    apagarExperiencia: async () => {},
    enviarCurriculo: async (_: string, f: File, anterior: string | null) => {
      banco.enviados.push({ nome: f.name, anterior });
      return { curriculo_caminho: `u1/${f.name}`, curriculo_nome: f.name, curriculo_tamanho: f.size, curriculo_enviado_em: '2026-10-06T13:12:00Z' };
    },
    removerCurriculo: async (_: string, c: string) => { banco.removidos.push(c); },
  };
});

const { default: MeuPerfil } = await import('./MeuPerfilCandidatoPage');
const { default: Curriculo } = await import('./CurriculoCandidatoPage');
const { default: MinhaArea } = await import('./MinhaAreaCandidatoPage');

const abrir = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/vagas/meu-perfil" element={<MeuPerfil />} />
      <Route path="/vagas/curriculo" element={<Curriculo />} />
      <Route path="/vagas/minha-area" element={<MinhaArea />} />
    </Routes>
  </MemoryRouter>,
);
const continuar = () => fireEvent.click(screen.getByRole('button', { name: /Continuar|Concluir perfil/ }));
const digitar = (rotulo: RegExp, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

beforeEach(() => {
  banco.perfil = { nome: 'Leonardo' }; banco.exps = []; banco.salvos = []; banco.enviados = []; banco.removidos = [];
});

describe('Meu perfil em 5 passos', () => {
  it('percorre os passos, grava cada um e termina em "Perfil pronto"', async () => {
    abrir('/vagas/meu-perfil');
    expect(await screen.findByRole('heading', { name: 'Sobre você' })).toBeInTheDocument();
    expect(screen.getByTestId('aviao-do-perfil')).toBeInTheDocument();

    continuar();
    expect(await screen.findByRole('alert')).toHaveTextContent('data de nascimento');
    digitar(/Nome completo/, 'leonardo alves da silva');
    digitar(/Data de nascimento/, '1999-03-14');
    continuar();

    expect(await screen.findByRole('heading', { name: 'Como falamos com você?' })).toBeInTheDocument();
    expect(banco.salvos[0]).toMatchObject({ nome: 'Leonardo Alves da Silva', nascimento: '1999-03-14' });
    digitar(/WhatsApp/, '19991234567');
    expect(screen.getByLabelText(/WhatsApp/)).toHaveValue('(19) 99123-4567');
    digitar(/Cidade/, 'campinas/sp');
    continuar();
    expect(await screen.findByRole('heading', { name: 'Até onde você estudou?' })).toBeInTheDocument();
    expect(banco.salvos[1]).toMatchObject({ cidade: 'Campinas/SP' });

    fireEvent.click(screen.getByRole('button', { name: 'Médio completo' }));
    continuar();

    expect(await screen.findByRole('heading', { name: 'Onde você já trabalhou?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Não tenho' }));

    expect(await screen.findByRole('heading', { name: 'Quando você pode trabalhar?' })).toBeInTheDocument();
    expect(banco.salvos.at(-1)).toMatchObject({ sem_experiencia: true });
    fireEvent.click(screen.getByRole('button', { name: 'Tarde' }));
    continuar();

    expect(await screen.findByRole('heading', { name: 'Perfil pronto.' })).toBeInTheDocument();
    const ultimo = banco.salvos.at(-1)!;
    expect(ultimo.disponibilidade).toEqual(['tarde']);
    expect(typeof ultimo.perfil_concluido_em).toBe('string');
  });

  it('?passo=3 abre na experiência; adicionar uma experiência a mostra na lista', async () => {
    abrir('/vagas/meu-perfil?passo=3');
    expect(await screen.findByRole('heading', { name: 'Onde você já trabalhou?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar experiência/ }));
    digitar(/^Função/, 'Educador Social');
    digitar(/^Onde$/, 'Instituto Sol Nascente');
    digitar(/^Início/, '2023-03');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar experiência' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('mês de saída');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trabalho lá hoje' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar experiência' }));
    expect(await screen.findByText('Instituto Sol Nascente · mar/2023 – atual')).toBeInTheDocument();
  });
});

describe('Currículo', () => {
  it('recusa formato errado, envia o PDF e troca apagando o anterior', async () => {
    abrir('/vagas/curriculo');
    const entrada = await screen.findByTestId('escolher-curriculo');
    fireEvent.change(entrada, { target: { files: [new File(['x'], 'cv.docx', { type: 'application/msword' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF, JPG ou PNG');

    fireEvent.change(entrada, { target: { files: [new File(['x'], 'cv-leo.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText('Recebido')).toBeInTheDocument();
    expect(screen.getByText('cv-leo.pdf')).toBeInTheDocument();

    fireEvent.change(entrada, { target: { files: [new File(['y'], 'cv-novo.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trocar' })).toBeInTheDocument());
    expect(screen.getByText('cv-novo.pdf')).toBeInTheDocument();
    expect(banco.enviados.at(-1)).toEqual({ nome: 'cv-novo.pdf', anterior: 'u1/cv-leo.pdf' });

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Remover' }));
    expect(await screen.findByRole('button', { name: 'Escolher arquivo' })).toBeInTheDocument();
    expect(banco.removidos).toEqual(['u1/cv-novo.pdf']);
  });

  it('tem o botão de foto que abre a câmera', async () => {
    abrir('/vagas/curriculo');
    expect(await screen.findByRole('button', { name: /Tirar foto do impresso/ })).toBeInTheDocument();
    expect(screen.getByTestId('foto-do-curriculo')).toHaveAttribute('capture', 'environment');
  });
});

describe('Minha área', () => {
  it('mostra o anel do perfil, o currículo e só o que falta', async () => {
    banco.perfil = { nome: 'Leonardo', nascimento: '1999-03-14', whatsapp: '(19) 99123-4567', cidade: 'Campinas', escolaridade: 'medio' };
    abrir('/vagas/minha-area');
    expect(await screen.findByRole('img', { name: '60% do perfil pronto' })).toBeInTheDocument();
    expect(screen.getByTestId('bloco-perfil')).toHaveAttribute('href', '/vagas/meu-perfil?passo=3');
    expect(screen.getByTestId('bloco-curriculo')).toHaveTextContent('Ainda não enviado');
    const faltas = screen.getByRole('list', { name: 'O que falta no perfil' });
    expect(within(faltas).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/vagas/meu-perfil?passo=3', '/vagas/meu-perfil?passo=4']);
  });
});
