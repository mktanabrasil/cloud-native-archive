import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const banco = vi.hoisted(() => ({
  lista: [] as Array<Record<string, unknown>>,
  movidos: [] as Array<[string, string, string | null]>,
  avisar: true,
  obs: [] as string[],
  rh: true,
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'rh1', email: 'carla@anabrasil.org', user_metadata: {} }, isAuthenticated: true, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isRh: banco.rh, loading: false, userName: 'Carla' }) }));
vi.mock('@/lib/vagas/rh', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/rh')>('@/lib/vagas/rh');
  const { paraVaga } = await vi.importActual<typeof import('@/lib/vagas/api')>('@/lib/vagas/api');
  const { paraCandidatura } = await vi.importActual<typeof import('@/lib/vagas/candidatura')>('@/lib/vagas/candidatura');
  const conv = (l: Record<string, unknown>) => ({ ...paraCandidatura(l), aberta_em: (l.aberta_em as string) ?? null });
  return {
    ...real,
    buscarVagaDoRh: async () => paraVaga({ id: 'v1', slug: 'educador', titulo: 'Educador Social de Música', codigo: 'SOC-2026-031', area: 'social', status: 'publicada' }),
    candidatosDaVaga: async () => banco.lista.map(conv),
    umaCandidatura: async (id: string) => { const l = banco.lista.find((x) => x.id === id); return l ? conv(l) : null; },
    abrirCandidatura: async () => {},
    historico: async () => [{ acao: 'enviada', de: null, para: 'recebida', por: 'candidato', em: '2026-10-09T12:00:00Z' }],
    lerObservacoes: async () => '',
    salvarObservacoes: async (_: string, t: string) => { banco.obs.push(t); },
    moverCandidatura: async (id: string, etapa: string, resultado: string | null) => {
      banco.movidos.push([id, etapa, resultado]);
      const l = banco.lista.find((x) => x.id === id)!; l.etapa = etapa; l.resultado = resultado;
      return { avisou: banco.avisar, falhouAviso: false };
    },
  };
});

const { default: Lista } = await import('./CandidatosDaVagaPage');
const { default: Ficha } = await import('./FichaDoCandidatoPage');
const { proximosPassos, textoDoMovimento, csvDosCandidatos } = await import('@/lib/vagas/rh');

const abrir = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/vagas/:slug/candidatos" element={<Lista />} />
      <Route path="/vagas/:slug/candidatos/:id" element={<Ficha />} />
    </Routes>
  </MemoryRouter>,
);

const C = (o: Record<string, unknown>) => ({
  id: 'c1', protocolo: '2026-000418', vaga_id: 'v1', etapa: 'recebida', resultado: null, aberta_em: null, retirada_em: null,
  created_at: new Date().toISOString(), origem: 'Instagram', curriculo_caminho: 'u1/c.pdf', curriculo_nome: 'cv.pdf',
  perfil: { nome: 'Leonardo Garbo Rodrigues', cidade: 'Campinas/SP', bairro: 'Vila Costa e Silva', escolaridade: 'superior', email: 'leo@x.com', whatsapp: '(19) 99355-8242', disponibilidade: ['manha'], experiencias: [{ funcao: 'Educador', onde: 'Instituto', inicio: '2023-03', fim: null, atual: true }] },
  requisitos: [{ texto: 'Ensino Médio completo', atende: true }, { texto: 'Disponibilidade à tarde', atende: false }],
  respostas: [{ pergunta_id: 'p1', texto: 'Conte uma oficina', tipo: 'texto_longo', resposta: 'Percussão com latas' }],
  ...o,
});

beforeEach(() => {
  banco.lista = [C({}), C({ id: 'c2', protocolo: '2026-000400', etapa: 'analise', aberta_em: '2026-10-08', perfil: { nome: 'Ana Paula Ribeiro', cidade: 'Campinas/SP', escolaridade: 'medio', experiencias: [] } }), C({ id: 'c3', protocolo: '2026-000390', retirada_em: '2026-10-08', perfil: { nome: 'Bruno Tavares' } })];
  banco.movidos = []; banco.obs = []; banco.avisar = true; banco.rh = true;
});

describe('candidatos da vaga', () => {
  it('lista, conta por etapa, filtra e busca', async () => {
    abrir('/vagas/educador/candidatos');
    expect(await screen.findAllByTestId('candidato')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Todas\s*2/ })).toBeInTheDocument();
    expect(screen.getByText('novo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Análise\s*1/ }));
    expect(screen.getAllByTestId('candidato')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Retiradas\s*1/ }));
    expect(screen.getByText('Bruno Tavares')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Todas/ }));
    fireEvent.change(screen.getByLabelText('Buscar por nome ou cidade'), { target: { value: 'ana paula' } });
    expect(screen.getAllByTestId('candidato')).toHaveLength(1);
  });

  it('quem não é RH não vê', async () => {
    banco.rh = false;
    abrir('/vagas/educador/candidatos');
    expect(screen.getByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
  });
});

describe('ficha', () => {
  it('mostra o que foi enviado e move: Análise, Entrevista, Aprovar', async () => {
    abrir('/vagas/educador/candidatos/c1');
    expect(await screen.findByRole('heading', { name: 'Leonardo Garbo Rodrigues' })).toBeInTheDocument();
    expect(screen.getByText('Percussão com latas')).toBeInTheDocument();
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir cv.pdf/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mover para Análise/ }));
    await screen.findByRole('button', { name: /Mover para Entrevista/ });
    fireEvent.click(screen.getByRole('button', { name: /Mover para Entrevista/ }));
    await screen.findByRole('button', { name: /Aprovar/ });
    fireEvent.click(screen.getByRole('button', { name: /Aprovar/ }));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Etapa: Aprovado' })).toBeInTheDocument());
    expect(banco.movidos).toEqual([['c1', 'analise', null], ['c1', 'entrevista', null], ['c1', 'resultado', 'aprovado']]);
  });

  it('não seguir e observações salvas sozinhas', async () => {
    abrir('/vagas/educador/candidatos/c1');
    fireEvent.click(await screen.findByRole('button', { name: /Não seguir/ }));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Etapa: Não selecionado' })).toBeInTheDocument());
    expect(banco.movidos).toEqual([['c1', 'resultado', 'nao_selecionado']]);
    fireEvent.change(screen.getByLabelText('Observações do RH'), { target: { value: 'ligar quinta' } });
    await waitFor(() => expect(banco.obs).toEqual(['ligar quinta']), { timeout: 2000 });
  });

  it('retirada não tem botões de mover', async () => {
    abrir('/vagas/educador/candidatos/c3');
    expect(await screen.findByText(/retirou a candidatura/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mover para/ })).toBeNull();
  });
});

describe('regras do painel', () => {
  it('próximos passos de cada etapa', () => {
    expect(proximosPassos({ etapa: 'recebida', resultado: null, retirada_em: null })).toMatchObject({ avancar: { etapa: 'analise' }, voltar: null, podeRecusar: true });
    expect(proximosPassos({ etapa: 'entrevista', resultado: null, retirada_em: null })).toMatchObject({ avancar: { etapa: 'resultado', resultado: 'aprovado' }, voltar: { etapa: 'analise' } });
    expect(proximosPassos({ etapa: 'resultado', resultado: 'nao_selecionado', retirada_em: null })).toMatchObject({ avancar: null, voltar: { etapa: 'entrevista' }, podeRecusar: false });
    expect(proximosPassos({ etapa: 'analise', resultado: null, retirada_em: '2026-10-09' })).toEqual({ avancar: null, voltar: null, podeRecusar: false });
  });

  it('histórico e planilha', () => {
    expect(textoDoMovimento({ acao: 'etapa', de: 'entrevista', para: 'resultado:aprovado', por: 'Carla', em: '' })).toBe('Entrevista → Aprovado · Carla');
    expect(textoDoMovimento({ acao: 'aberta', de: null, para: null, por: 'Carla', em: '' })).toBe('Aberta por Carla');
    const linhas = csvDosCandidatos([{ ...C({}), aberta_em: null } as never]).replace('﻿', '').trim().split('\r\n');
    expect(linhas[0]).toMatch(/^Protocolo;Enviada;Nome;WhatsApp;E-mail;Cidade;Bairro;Formação;Experiências;Requisitos marcados;Currículo;Etapa;Retirada$/);
    expect(linhas[1]).toMatch(/2026-000418;.*;Leonardo Garbo Rodrigues;\(19\) 99355-8242;leo@x\.com;Campinas\/SP;Vila Costa e Silva;Superior completo;1;1 de 2;sim;Recebida;não$/);
  });
});
