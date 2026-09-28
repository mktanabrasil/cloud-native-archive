import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Vaga } from '@/lib/vagas/modelo';

const espiao = vi.hoisted(() => ({ vagas: [] as Vaga[], falha: false, rh: false, usuario: null as null | { email: string; user_metadata: Record<string, unknown> } }));

vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isRh: espiao.rh }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: espiao.usuario, isAuthenticated: espiao.usuario !== null, loading: false, signOut: vi.fn() }) }));
vi.mock('@/components/vagas/GestaoDeVagas', () => ({ GestaoDeVagas: () => <p>painel da gestão</p> }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/vagas/api', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/api')>('@/lib/vagas/api');
  return {
    ...real,
    listarVagasPublicadas: async () => { if (espiao.falha) throw new Error('rede'); return espiao.vagas; },
    buscarVaga: async (slug: string) => { if (espiao.falha) throw new Error('rede'); return espiao.vagas.find(v => v.slug === slug) ?? null; },
  };
});

const { paraVaga } = await import('@/lib/vagas/api');
const { default: VagasPage } = await import('./VagasPage');
const { default: VagaPage } = await import('./VagaPage');

const vaga = (o: Record<string, unknown>) => paraVaga({ status: 'publicada', cidade: 'Campinas/SP', carga_horaria: '40h', ...o, id: String(o.slug) });

const abrir = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/vagas" element={<VagasPage />} />
      <Route path="/vagas/:slug" element={<VagaPage />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  // Estes testes são da vitrine: o visitante já escolheu "ver as vagas sem entrar".
  sessionStorage.setItem('vagas-ver-sem-entrar', '1');
  espiao.falha = false;
  espiao.rh = false;
  espiao.usuario = null;
  espiao.vagas = [
    vaga({ slug: 'educador-social-de-musica', titulo: 'Educador Social de Música', area: 'social', requisitos: ['Ensino Médio completo'], diferenciais: ['Formação em música'], beneficios: ['Vale-transporte'], link_externo: 'https://forms.gle/abc' }),
    vaga({ slug: 'professor-de-educacao-infantil', titulo: 'Professor de Educação Infantil', area: 'educacao', afirmativa_pcd: true }),
    vaga({ slug: 'auxiliar-administrativo', titulo: 'Auxiliar Administrativo', area: 'administracao' }),
  ];
});

describe('portal /vagas', () => {
  it('mostra o total, um bloco por área e os cartões', async () => {
    abrir('/vagas');
    expect(await screen.findByText(/3 vagas abertas/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Educador Social de Música/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Administração\s*1\s*vaga aberta/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vagas afirmativas PcD' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Jovem Aprendiz' })).not.toBeInTheDocument();
  });

  it('filtra pela área e pela busca sem acento', async () => {
    abrir('/vagas');
    await screen.findByText(/3 vagas abertas/);
    const filtros = screen.getByRole('region', { name: 'Vagas abertas' });
    fireEvent.click(within(filtros).getByRole('button', { name: 'Educação' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: /Educador Social/ })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Professor de Educação Infantil/ })).toBeInTheDocument();

    fireEvent.click(within(filtros).getByRole('button', { name: /Todas/ }));
    fireEvent.change(screen.getByLabelText('Buscar vaga'), { target: { value: 'musica' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: /Professor/ })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Educador Social de Música/ })).toBeInTheDocument();
  });

  it('abre já filtrada pelo endereço (embed do GOE) e avisa quando não acha nada', async () => {
    abrir('/vagas?area=educacao&q=cozinha');
    expect(await screen.findByText('Nada encontrado para "cozinha".')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas as vagas' }));
    expect(await screen.findAllByRole('link', { name: /Auxiliar Administrativo/ })).toHaveLength(1);
  });

  it('sem nenhuma vaga, diz isso em vez de uma lista vazia', async () => {
    espiao.vagas = [];
    abrir('/vagas');
    expect(await screen.findByText('Nenhuma vaga aberta agora.')).toBeInTheDocument();
  });

  it('erro de rede oferece tentar de novo', async () => {
    espiao.falha = true;
    abrir('/vagas');
    expect(await screen.findByText('Não deu para carregar as vagas.')).toBeInTheDocument();
    espiao.falha = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText(/3 vagas abertas/)).toBeInTheDocument();
  });
});

describe('abas do RH', () => {
  it('o público não vê aba; o RH vê Portal e Gestão, e ?tela=gestao abre a gestão', async () => {
    const { unmount } = abrir('/vagas?tela=gestao');
    expect(await screen.findByText(/3 vagas abertas/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gestão' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Voltar ao app/ })).not.toBeInTheDocument();
    unmount();

    espiao.rh = true;
    espiao.usuario = { email: 'rh@anabrasil.org', user_metadata: { name: 'RH' } };
    abrir('/vagas?tela=gestao');
    expect(screen.getByText('painel da gestão')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voltar ao app/ })).toHaveAttribute('href', '/');
    fireEvent.click(screen.getByRole('button', { name: 'Portal' }));
    expect(await screen.findByText(/3 vagas abertas/)).toBeInTheDocument();
  });
});

describe('página da vaga', () => {
  it('mostra requisitos, diferencial, benefícios e o Forms no botão', async () => {
    abrir('/vagas/educador-social-de-musica');
    expect(await screen.findByRole('heading', { level: 1, name: 'Educador Social de Música' })).toBeInTheDocument();
    expect(screen.getByText('Ensino Médio completo')).toBeInTheDocument();
    expect(screen.getByText('Diferencial: Formação em música')).toBeInTheDocument();
    expect(screen.getByText('Vale-transporte')).toBeInTheDocument();
    const botao = screen.getByRole('link', { name: /Candidatar-se/ });
    expect(botao).toHaveAttribute('href', 'https://forms.gle/abc');
    expect(botao).toHaveAttribute('target', '_blank');
  });

  it('sem Forms, o botão avisa que as inscrições abrem em breve', async () => {
    abrir('/vagas/professor-de-educacao-infantil');
    expect(await screen.findByRole('button', { name: 'Inscrições em breve' })).toBeDisabled();
    expect(screen.getByText(/Vaga afirmativa para pessoas com deficiência/)).toBeInTheDocument();
  });

  it('encerrada ou endereço errado: leva para as vagas abertas', async () => {
    abrir('/vagas/vaga-que-fechou');
    expect(await screen.findByRole('heading', { name: 'Esta vaga não está mais aberta.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver vagas abertas/ })).toHaveAttribute('href', '/vagas');
  });
});

describe('topo das vagas conforme quem olha (PR 6)', () => {
  it('visitante vê Entrar e Criar conta', async () => {
    abrir('/vagas');
    await screen.findByText(/3 vagas abertas/);
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/vagas/entrar');
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/vagas/criar-conta');
  });

  it('candidato vê a área dele, com a inicial do nome', async () => {
    espiao.usuario = { email: 'leo@exemplo.com', user_metadata: { conta: 'candidato', name: 'Leonardo Silva' } };
    abrir('/vagas');
    await screen.findByText(/3 vagas abertas/);
    const minha = screen.getByRole('link', { name: /Minha área/ });
    expect(minha).toHaveAttribute('href', '/vagas/minha-area');
    expect(minha).toHaveTextContent('L');
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});

describe('a porta de /vagas (28/09/2026, caminho 1)', () => {
  it('visitante que abre /vagas cai no login, e pode ver as vagas sem entrar', async () => {
    sessionStorage.clear();
    abrir('/vagas');
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByText(/3 vagas abertas/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver as vagas sem entrar/ }));
    expect(await screen.findByText(/3 vagas abertas/)).toBeInTheDocument();
    expect(sessionStorage.getItem('vagas-ver-sem-entrar')).toBe('1');
  });

  it('link com filtro abre as vagas direto, e limpar o filtro não volta para a porta', async () => {
    sessionStorage.clear();
    abrir('/vagas?area=educacao');
    expect(await screen.findByRole('link', { name: /Professor de Educação Infantil/ })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('region', { name: 'Vagas abertas' })).getByRole('button', { name: /Todas/ }));
    expect(await screen.findAllByRole('link', { name: /Auxiliar Administrativo/ })).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('quem tem conta vê a vitrine direto', async () => {
    sessionStorage.clear();
    espiao.usuario = { email: 'leo@exemplo.com', user_metadata: { conta: 'candidato', name: 'Leonardo' } };
    abrir('/vagas');
    expect(await screen.findByText(/3 vagas abertas/)).toBeInTheDocument();
  });

  it('link de uma vaga abre a vaga, sem porta', async () => {
    sessionStorage.clear();
    abrir('/vagas/educador-social-de-musica');
    expect(await screen.findByRole('heading', { level: 1, name: 'Educador Social de Música' })).toBeInTheDocument();
  });
});

describe('o cartão da vaga (modelo 1, versão B, 28/09/2026)', () => {
  it('mostra o ícone do trabalho, que se mexe do jeito dele, e a frase do que a vaga pede', async () => {
    abrir('/vagas');
    const cartao = await screen.findByRole('link', { name: /Educador Social de Música/ });
    expect(cartao).toHaveClass('vg-cartao');
    expect(cartao.querySelector('[data-mov="danca"]')).not.toBeNull();
    expect(cartao).toHaveTextContent('Requisito: Ensino Médio completo');
    expect(cartao).toHaveTextContent('Aberta');
  });
});

describe('grade ou lista, e os programas no fim (28/09/2026)', () => {
  const comProgramas = () => {
    espiao.vagas.push(
      vaga({ slug: 'jovem-aprendiz', titulo: 'Jovem Aprendiz', area: 'social', contratacao: 'aprendiz', aprendizagem: true }),
      vaga({ slug: 'vagas-pcd', titulo: 'Vagas para Pessoas com Deficiência', area: 'social', afirmativa_pcd: true }),
    );
  };

  it('Jovem Aprendiz e PcD vão para "Programas para todos", no fim, com os ícones oficiais', async () => {
    comProgramas();
    abrir('/vagas');
    const bloco = await screen.findByRole('region', { name: 'Programas para todos' });
    const nomes = within(bloco).getAllByRole('link').map(l => l.querySelector('h3')?.textContent);
    expect(nomes).toEqual(['Jovem Aprendiz', 'Vagas para Pessoas com Deficiência']);
    expect(within(bloco).getByText('Lei da Aprendizagem (Lei 10.097/2000)')).toBeInTheDocument();
    expect(bloco.querySelector('img[src="/icones-vagas/acessibilidade.jpg"]')).not.toBeNull();
    // e não aparecem entre as vagas comuns
    const todos = screen.getAllByRole('link', { name: /Jovem Aprendiz/ });
    expect(todos).toHaveLength(1);
  });

  it('o botão Lista troca a vista e a escolha fica guardada', async () => {
    localStorage.removeItem('vagas-vista');
    abrir('/vagas');
    await screen.findByText(/3 vagas abertas/);
    expect(screen.getByRole('button', { name: 'Grade' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('vagas-vista')).toBe('lista');
    // na lista, sem a faixa com a frase
    const cartao = screen.getByRole('link', { name: /Educador Social de Música/ });
    expect(cartao).not.toHaveTextContent('Requisito:');
    localStorage.removeItem('vagas-vista');
  });

  it('os filtros têm ícone', async () => {
    abrir('/vagas');
    await screen.findByText(/3 vagas abertas/);
    const filtros = screen.getByRole('group', { name: 'Filtros' });
    within(filtros).getAllByRole('button').forEach(b => expect(b.querySelector('svg')).not.toBeNull());
  });
});

