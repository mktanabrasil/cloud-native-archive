import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/** Voluntariado do Natal Feliz (20/10/2026): o formulário público e o painel. */

const banco = vi.hoisted(() => ({
  enviados: [] as Array<Record<string, unknown>>,
  lista: [] as Array<Record<string, unknown>>,
  apagados: [] as string[],
  planilhaPedida: 0,
  chamadas: [] as Array<Record<string, unknown>>,
  estado: null as null | Record<string, unknown>,
  baixados: [] as string[],
  erro: null as string | null,
  papel: { isMarketing: true, loading: false },
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => banco.papel }));
vi.mock('@/lib/enquetes/planilha', () => ({ baixarArquivo: (_: string, nome: string) => { banco.baixados.push(nome); } }));
vi.mock('@/lib/voluntariado/api', () => ({
  inscrever: async (d: Record<string, unknown>) => { if (banco.erro) throw new Error(banco.erro); banco.enviados.push(d); return 'VL-7K2Q9'; },
  listarInscricoes: async () => banco.lista,
  apagarInscricao: async (id: string) => { banco.apagados.push(id); },
  enviarParaAPlanilha: () => { banco.planilhaPedida++; },
  chamarPlanilha: async (c: Record<string, unknown>) => {
    banco.chamadas.push(c);
    if (c.estado) return banco.estado ?? { drive_conectado: true, google_email: 'contato@anabrasil.org', planilha: null, pendentes: 0 };
    if (c.criar) { banco.estado = { drive_conectado: true, google_email: 'contato@anabrasil.org', planilha: { link: 'https://docs.google.com/spreadsheets/d/abc/edit', criada_por: 'mkt', criada_em: '2026-10-21T12:00:00Z', erro: null }, pendentes: 0 }; return { link: 'https://docs.google.com/spreadsheets/d/abc/edit', enviadas: 2 }; }
    return { enviadas: 3, pendentes: 0 };
  },
}));

const { default: Voluntariado } = await import('./VoluntariadoPage');
const { PainelDoVoluntariado } = await import('@/components/voluntariado/PainelDoVoluntariado');
const { tocarArea, problemaDaInscricao, mascaraDoWhatsapp, digitosDoWhatsapp, AREAS_DE_AJUDA, GRUPOS_DO_FORMULARIO, UNIDADES_DO_VOLUNTARIADO } = await import('@/lib/voluntariado/modelo');
const { csvDasInscricoes } = await import('@/lib/voluntariado/planilha');

const I = (o: Record<string, unknown>) => ({ id: 'i1', protocolo: 'VL-7K2Q9', nome: 'Leonardo Garbo Rodrigues', whatsapp: '19993558242', unidade_id: 'santana', unidade_nome: 'Santana', area: 'social', opcao1: 'cozinha', opcao2: 'decoracao', created_at: '2026-10-20T15:00:00Z', ...o });

beforeEach(() => {
  banco.enviados = []; banco.lista = []; banco.apagados = []; banco.baixados = []; banco.erro = null;
  banco.planilhaPedida = 0; banco.chamadas = []; banco.estado = null;
  window.open = vi.fn() as never;
  banco.papel = { isMarketing: true, loading: false };
});

describe('regras', () => {
  it('16 áreas no formulário (Som saiu em 21/10/2026), cada uma com uma frase curta', () => {
    expect(AREAS_DE_AJUDA).toHaveLength(17);
    expect(GRUPOS_DO_FORMULARIO.flatMap((g) => g.areas.map(([k]) => k))).toHaveLength(16);
    expect(GRUPOS_DO_FORMULARIO.flatMap((g) => g.areas.map(([k]) => k))).not.toContain('som');
    expect(UNIDADES_DO_VOLUNTARIADO.flatMap((g) => g.unidades.map((u) => u.id))).not.toContain('ana-piaui');
    // Só a Educação (21/10/2026): o GOE e as 11 CEIs; o Social sai.
    const ids = UNIDADES_DO_VOLUNTARIADO.flatMap((g) => g.unidades.map((u) => u.id));
    expect(ids).toHaveLength(12);
    expect(ids).toContain('goe');
    expect(ids).not.toContain('ana-dic');
    expect(AREAS_DE_AJUDA.every((a) => a.descricao.length > 10 && a.descricao.length < 90)).toBe(true);
  });

  it('tocar: 1ª, depois 2ª; tocar de novo desmarca e a 2ª sobe', () => {
    let o = tocarArea({ opcao1: null, opcao2: null }, 'cozinha');
    o = tocarArea(o, 'som');
    expect(o).toEqual({ opcao1: 'cozinha', opcao2: 'som' });
    expect(tocarArea(o, 'cozinha')).toEqual({ opcao1: 'som', opcao2: null });
    expect(tocarArea(o, 'som')).toEqual({ opcao1: 'cozinha', opcao2: null });
    expect(tocarArea(o, 'decoracao')).toEqual({ opcao1: 'cozinha', opcao2: 'decoracao' });
  });

  it('WhatsApp com máscara, aceita o 55 na frente', () => {
    expect(mascaraDoWhatsapp('19993558242')).toBe('(19) 99355-8242');
    expect(mascaraDoWhatsapp('1933334444')).toBe('(19) 3333-4444');
    expect(digitosDoWhatsapp('+55 (19) 99355-8242')).toBe('19993558242');
  });

  it('o que falta, na ordem do formulário', () => {
    const ok = { nome: 'Ana Paula', whatsapp: '(19) 99999-8888', unidade: 'santana', opcao1: 'cozinha' as const };
    expect(problemaDaInscricao(ok)).toBeNull();
    expect(problemaDaInscricao({ ...ok, nome: 'Ana' })).toMatch(/nome completo/);
    expect(problemaDaInscricao({ ...ok, whatsapp: '9999' })).toMatch(/WhatsApp/);
    expect(problemaDaInscricao({ ...ok, unidade: null })).toMatch(/unidade/);
    expect(problemaDaInscricao({ ...ok, opcao1: null })).toMatch(/onde você quer ajudar/);
  });

  it('a planilha tem o WhatsApp legível e as duas opções pelo nome', () => {
    const csv = csvDasInscricoes([I({}) as never]).replace('﻿', '').split('\r\n');
    expect(csv[0]).toBe('Protocolo;Quando;Nome;WhatsApp;Unidade;Área;1ª opção;2ª opção');
    expect(csv[1]).toMatch(/^VL-7K2Q9;.*;Leonardo Garbo Rodrigues;\(19\) 99355-8242;Santana;Social;Cozinha \/ Servimento;Decoração$/);
  });
});

describe('formulário', () => {
  const preencher = () => {
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'leonardo garbo rodrigues' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '19993558242' } });
    const unidade = screen.getByLabelText('Unidade em que você trabalha') as HTMLSelectElement;
    fireEvent.change(unidade, { target: { value: unidade.options[1].value } });
  };

  it('nome, WhatsApp, unidade, 1ª e 2ª opção até o protocolo e os próximos passos', async () => {
    render(<MemoryRouter><Voluntariado /></MemoryRouter>);
    // Topo de 21/10/2026: a data ao lado do título, as inscrições embaixo e o texto do evento antes das perguntas.
    expect(screen.getByTestId('dia-do-evento')).toHaveTextContent('08/12 · Natal Feliz');
    expect(screen.getByText('Inscrições até 15/11')).toBeInTheDocument();
    const sobre = screen.getByTestId('sobre-o-evento');
    expect(sobre).toHaveTextContent('Neste Natal, seja o presente de alguém');
    expect(sobre).toHaveTextContent('quem vai, vai porque escolheu fazer a diferença');
    expect(sobre).toHaveTextContent('Vem com a gente fazer parte dessa história?');
    expect(sobre).toHaveTextContent('em parceria com a JNI');
    expect(sobre.compareDocumentPosition(screen.getByLabelText('Nome completo')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    preencher();
    expect(screen.getByLabelText('WhatsApp')).toHaveValue('(19) 99355-8242');
    // Cada área com a frase dela.
    const cozinha = screen.getByRole('button', { name: /Cozinha \/ Servimento/ });
    expect(cozinha).toHaveTextContent('Auxiliar a equipe na preparação e no servimento das refeições.');
    fireEvent.click(cozinha);
    fireEvent.click(screen.getByRole('button', { name: /^Decoração/ }));
    expect(cozinha).toHaveTextContent('1ª');
    expect(screen.getByRole('button', { name: /^Decoração/ })).toHaveTextContent('2ª');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar inscrição' }));
    expect(await screen.findByTestId('protocolo')).toHaveTextContent('VL-7K2Q9');
    // Logo depois de inscrever, pede para a linha entrar na planilha do Google (21/10/2026).
    expect(banco.planilhaPedida).toBe(1);
    expect(banco.enviados[0]).toMatchObject({ nome: 'leonardo garbo rodrigues', whatsapp: '(19) 99355-8242', opcao1: 'cozinha', opcao2: 'decoracao' });
    expect(screen.getByTestId('agradecimento')).toHaveTextContent('Obrigado por fazer parte do Dia do Voluntariado!');
    expect(screen.getByTestId('proximos-passos')).toHaveTextContent('a equipe vai entrar em contato com você para a assinatura do termo de voluntariado e dará mais informações em breve');
    expect(screen.getByText('Decoração')).toBeInTheDocument();
  });

  it('sem a área Som e sem a ANA Piauí (21/10/2026)', () => {
    render(<MemoryRouter><Voluntariado /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /^Som/ })).toBeNull();
    const opcoes = [...(screen.getByLabelText('Unidade em que você trabalha') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(opcoes).not.toContain('ANA Piauí');
    expect(opcoes).not.toContain('ANA DIC');
    expect(opcoes).toContain('Grupo de Oração Esperança');
  });

  it('sem área, avisa e não envia', async () => {
    render(<MemoryRouter><Voluntariado /></MemoryRouter>);
    preencher();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar inscrição' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha onde você quer ajudar.');
    expect(banco.enviados).toHaveLength(0);
  });

  it('WhatsApp já inscrito: explica o que fazer', async () => {
    banco.erro = 'ja_inscrito';
    render(<MemoryRouter><Voluntariado /></MemoryRouter>);
    preencher();
    fireEvent.click(screen.getByRole('button', { name: /Projeção/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar inscrição' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Este WhatsApp já está inscrito. Para mudar a área, fale com a equipe.');
  });
});

describe('painel', () => {
  it('conta por área (1ª opção, +2ª ao lado), marca as vazias e filtra por área', async () => {
    banco.lista = [I({}), I({ id: 'i2', protocolo: 'VL-ABCDE', nome: 'Ana Paula', unidade_id: 'dic', unidade_nome: 'DIC', opcao1: 'decoracao', opcao2: null })];
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    expect(await screen.findAllByTestId('inscricao')).toHaveLength(2);
    expect(screen.getByTestId('kpi-Inscritos')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-Áreas sem ninguém')).toHaveTextContent('14');
    const decoracao = screen.getAllByTestId('barra-area').find((b) => b.textContent?.startsWith('Decoração'))!;
    expect(decoracao).toHaveTextContent('Decoração1 +1');
    fireEvent.click(decoracao);
    expect(screen.getAllByTestId('inscricao')).toHaveLength(2); // as duas têm Decoração (1ª ou 2ª)
    fireEvent.click(screen.getAllByTestId('barra-area').find((b) => b.textContent?.startsWith('Cozinha'))!);
    expect(screen.getAllByTestId('inscricao')).toHaveLength(1);
    expect(within(screen.getByTestId('inscricao')).getByRole('link', { name: '(19) 99355-8242' })).toHaveAttribute('href', 'https://wa.me/5519993558242');
  });

  it('filtra por unidade, baixa a planilha e apaga com confirmação', async () => {
    banco.lista = [I({}), I({ id: 'i2', protocolo: 'VL-ABCDE', nome: 'Ana Paula', unidade_id: 'dic', unidade_nome: 'DIC' })];
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'DIC' }));
    expect(screen.getAllByTestId('inscricao')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Baixar planilha/ }));
    expect(banco.baixados[0]).toMatch(/^voluntariado-natal-feliz-dic-/);
    fireEvent.click(screen.getByRole('button', { name: 'Apagar VL-ABCDE' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(banco.apagados).toEqual(['i2']));
  });

  it('a área Som some do painel, a não ser que alguém já a tenha escolhido', async () => {
    banco.lista = [I({ opcao1: 'cozinha', opcao2: null })];
    const { unmount } = render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    await screen.findAllByTestId('inscricao');
    expect(screen.getAllByTestId('barra-area').some((b) => b.textContent?.startsWith('Som'))).toBe(false);
    unmount();
    banco.lista = [I({ opcao1: 'som', opcao2: null })];
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    await screen.findAllByTestId('inscricao');
    expect(screen.getAllByTestId('barra-area').some((b) => b.textContent?.startsWith('Som'))).toBe(true);
  });

  it('quem não é da comunicação não entra', () => {
    banco.papel = { isMarketing: false, loading: false };
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    expect(screen.getByText('Acesso restrito')).toBeInTheDocument();
  });
});

describe('planilha do Google (21/10/2026)', () => {
  it('sem o Drive da Pizza conectado, explica o que fazer', async () => {
    banco.estado = { drive_conectado: false, google_email: null, planilha: null, pendentes: 0 };
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    expect(await screen.findByTestId('planilha-google')).toHaveTextContent('conecte antes o Drive na aba Pizza da Alegria');
  });

  it('criar pede confirmação (apagar os testes antes) e abre a planilha', async () => {
    banco.lista = [I({}), I({ id: 'i2', protocolo: 'VL-ABCDE' })];
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Criar planilha do Google/ }));
    expect(await screen.findByText('Criar a planilha com 2 inscrições?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Criar planilha' }));
    await waitFor(() => expect(banco.chamadas).toContainEqual({ criar: true }));
    expect(window.open).toHaveBeenCalledWith('https://docs.google.com/spreadsheets/d/abc/edit', '_blank', 'noopener');
    expect(await screen.findByRole('link', { name: /Abrir planilha do Google/ })).toHaveAttribute('href', 'https://docs.google.com/spreadsheets/d/abc/edit');
  });

  it('com pendentes ou erro, oferece "Enviar agora"', async () => {
    banco.estado = { drive_conectado: true, google_email: 'contato@anabrasil.org', planilha: { link: 'https://docs.google.com/x', criada_por: 'mkt', criada_em: '2026-10-21T12:00:00Z', erro: null }, pendentes: 3 };
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    expect(await screen.findByTestId('planilha-google')).toHaveTextContent('3 inscrições ainda não entraram.');
    fireEvent.click(screen.getByRole('button', { name: /Enviar agora/ }));
    await waitFor(() => expect(banco.chamadas).toContainEqual({ sincronizar: true }));
  });
});
