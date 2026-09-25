import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Vaga } from '@/lib/vagas/modelo';

const espiao = vi.hoisted(() => ({ vagas: [] as Vaga[], falha: false, rh: false }));

vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isRh: espiao.rh }) }));
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
  espiao.falha = false;
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
