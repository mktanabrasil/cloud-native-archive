import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/** Voluntariado do Natal Feliz (20/10/2026; em etapas desde 23/10/2026): o formulário público e o painel. */

const banco = vi.hoisted(() => ({
  enviados: [] as Array<Record<string, unknown>>,
  lista: [] as Array<Record<string, unknown>>,
  apagados: [] as string[],
  planilhaPedida: 0,
  chamadas: [] as Array<Record<string, unknown>>,
  estado: null as null | Record<string, unknown>,
  baixados: [] as string[],
  comprovantes: [] as Array<Record<string, unknown>>,
  erro: null as string | null,
  lotadas: [] as string[],
  metas: {} as Record<string, number>,
  metasSalvas: [] as Array<[string, number | null]>,
  papel: { isMarketing: true, loading: false },
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => banco.papel }));
vi.mock('@/lib/enquetes/planilha', () => ({ baixarArquivo: (_: string, nome: string) => { banco.baixados.push(nome); } }));
vi.mock('@/lib/voluntariado/comprovante', () => ({ salvarComprovante: async (d: Record<string, unknown>) => { banco.comprovantes.push(d); return 'baixado'; } }));
vi.mock('@/lib/voluntariado/api', () => ({
  inscrever: async (d: Record<string, unknown>) => { if (banco.erro) throw new Error(banco.erro); banco.enviados.push(d); return 'VL-7K2Q9'; },
  areasLotadas: async () => banco.lotadas,
  listarInscricoes: async () => banco.lista,
  apagarInscricao: async (id: string) => { banco.apagados.push(id); },
  lerMetas: async () => banco.metas,
  definirMetaDaArea: async (area: string, meta: number | null) => { banco.metasSalvas.push([area, meta]); },
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
const { tocarArea, pedeAvisoDeLotada, problemaDaEtapa2, mascaraDoWhatsapp, digitosDoWhatsapp, AREAS_DE_AJUDA, AREAS_POR_VINCULO, UNIDADES_DO_VOLUNTARIADO } = await import('@/lib/voluntariado/modelo');
const { csvDasInscricoes } = await import('@/lib/voluntariado/planilha');

const I = (o: Record<string, unknown>) => ({
  id: 'i1', protocolo: 'VL-7K2Q9', nome: 'Leonardo Garbo Rodrigues', whatsapp: '19993558242', vinculo: 'funcionario', horario: 'manha',
  unidade_id: 'goe', unidade_nome: 'Grupo de Oração Esperança', area: 'educacao', indicado_por: null, igreja: null,
  opcao1: 'cozinha', opcao2: 'decoracao', created_at: '2026-10-20T15:00:00Z', ...o,
});

beforeEach(() => {
  banco.enviados = []; banco.lista = []; banco.apagados = []; banco.baixados = []; banco.comprovantes = []; banco.erro = null;
  banco.planilhaPedida = 0; banco.chamadas = []; banco.estado = null; banco.lotadas = []; banco.metas = {}; banco.metasSalvas = [];
  window.open = vi.fn() as never;
  banco.papel = { isMarketing: true, loading: false };
});

describe('regras', () => {
  it('só as áreas do dia do evento; cada vínculo com as suas (23/10/2026)', () => {
    expect(AREAS_DE_AJUDA).toHaveLength(10); // as 3 tiradas continuam conhecidas, para quem já as escolheu
    expect(AREAS_DE_AJUDA.every((a) => a.descricao.length > 40)).toBe(true);
    expect(AREAS_POR_VINCULO.funcionario).toEqual(['cozinha', 'inflaveis', 'estacoes']);
    expect(AREAS_POR_VINCULO.alcance).toEqual(['cozinha', 'louvor_kids', 'som', 'recreacao_kids', 'inflaveis', 'presentes_kids']);
    expect(AREAS_POR_VINCULO.comunidade).toEqual(['cozinha', 'inflaveis', 'estacoes']);
    for (const k of ['montagem', 'decoracao', 'limpeza_pre'] as const) {
      expect(Object.values(AREAS_POR_VINCULO).flat()).not.toContain(k);
    }
    // Presentes, Som, Louvor e Recreação são só do Alcance JNI.
    for (const k of ['presentes_kids', 'som', 'louvor_kids', 'recreacao_kids'] as const) {
      expect(AREAS_POR_VINCULO.funcionario).not.toContain(k);
      expect(AREAS_POR_VINCULO.comunidade).not.toContain(k);
    }
  });

  it('a lista de áreas da função do banco é a mesma do formulário', async () => {
    const { readFileSync } = await import('node:fs');
    const sql = readFileSync('supabase/migrations/20261023210000_voluntariado_dia_do_evento.sql', 'utf8');
    const lista = (v: string) => sql.match(new RegExp(`WHEN '${v}' +THEN ARRAY\\[([^\\]]+)\\]`))![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1));
    for (const v of ['funcionario', 'alcance', 'comunidade'] as const) expect(lista(v), v).toEqual([...AREAS_POR_VINCULO[v]]);
  });

  it('funcionário: só a Educação, sem a ANA Piauí', () => {
    const ids = UNIDADES_DO_VOLUNTARIADO.flatMap((g) => g.unidades.map((u) => u.id));
    expect(ids).toHaveLength(12);
    expect(ids).toContain('goe');
    expect(ids).not.toContain('ana-dic');
    expect(ids).not.toContain('ana-piaui');
  });

  it('tocar: 1ª, depois 2ª; tocar de novo desmarca e a 2ª sobe', () => {
    let o = tocarArea({ opcao1: null, opcao2: null }, 'cozinha');
    o = tocarArea(o, 'som');
    expect(o).toEqual({ opcao1: 'cozinha', opcao2: 'som' });
    expect(tocarArea(o, 'cozinha')).toEqual({ opcao1: 'som', opcao2: null });
    expect(tocarArea(o, 'som')).toEqual({ opcao1: 'cozinha', opcao2: null });
    expect(tocarArea(o, 'decoracao')).toEqual({ opcao1: 'cozinha', opcao2: 'decoracao' });
  });

  it('área lotada nunca vira 1ª opção', () => {
    const lotadas = ['cozinha'];
    expect(pedeAvisoDeLotada({ opcao1: null, opcao2: null }, 'cozinha', lotadas)).toBe(true);
    expect(pedeAvisoDeLotada({ opcao1: 'montagem', opcao2: null }, 'cozinha', lotadas)).toBe(false);
    expect(tocarArea({ opcao1: null, opcao2: null }, 'cozinha', lotadas)).toEqual({ opcao1: null, opcao2: 'cozinha' });
    expect(tocarArea({ opcao1: 'montagem', opcao2: null }, 'cozinha', lotadas)).toEqual({ opcao1: 'montagem', opcao2: 'cozinha' });
    // Tirar a 1ª não faz a lotada subir.
    expect(tocarArea({ opcao1: 'montagem', opcao2: 'cozinha' }, 'montagem', lotadas)).toEqual({ opcao1: null, opcao2: 'cozinha' });
  });

  it('WhatsApp com máscara, aceita o 55 na frente', () => {
    expect(mascaraDoWhatsapp('19993558242')).toBe('(19) 99355-8242');
    expect(mascaraDoWhatsapp('1933334444')).toBe('(19) 3333-4444');
    expect(digitosDoWhatsapp('+55 (19) 99355-8242')).toBe('19993558242');
  });

  it('o que falta na etapa 2, na ordem do formulário', () => {
    const ok = { nome: 'Ana Paula', whatsapp: '(19) 99999-8888', horario: 'manha' as const, vinculo: 'funcionario' as const, unidade: 'goe', indicado: null, indicadoPor: '' };
    expect(problemaDaEtapa2(ok)).toBeNull();
    expect(problemaDaEtapa2({ ...ok, nome: 'Ana' })).toMatch(/nome completo/);
    expect(problemaDaEtapa2({ ...ok, whatsapp: '9999' })).toMatch(/WhatsApp/);
    expect(problemaDaEtapa2({ ...ok, horario: null })).toMatch(/horário/);
    expect(problemaDaEtapa2({ ...ok, vinculo: null })).toMatch(/funcionário/);
    expect(problemaDaEtapa2({ ...ok, unidade: null })).toMatch(/unidade/);
    expect(problemaDaEtapa2({ ...ok, vinculo: 'alcance', unidade: null })).toBeNull();
    expect(problemaDaEtapa2({ ...ok, vinculo: 'comunidade', unidade: null })).toMatch(/te indicou/);
    expect(problemaDaEtapa2({ ...ok, vinculo: 'comunidade', unidade: null, indicado: true })).toMatch(/nome de quem te indicou/);
    // A igreja é obrigatória para quem é de fora (23/10/2026).
    expect(problemaDaEtapa2({ ...ok, vinculo: 'comunidade', unidade: null, indicado: false })).toMatch(/faz parte de alguma igreja/);
    expect(problemaDaEtapa2({ ...ok, vinculo: 'comunidade', unidade: null, indicado: false, temIgreja: true, igreja: '' })).toMatch(/nome da sua igreja/);
    expect(problemaDaEtapa2({ ...ok, vinculo: 'comunidade', unidade: null, indicado: false, temIgreja: false })).toBeNull();
    expect(problemaDaEtapa2({ ...ok, vinculo: 'comunidade', unidade: null, indicado: false, temIgreja: true, igreja: 'Igreja Batista' })).toBeNull();
  });

  it('a planilha tem as colunas novas, com o vínculo e o horário pelo nome', () => {
    const csv = csvDasInscricoes([I({}) as never, I({ protocolo: 'VL-ABCDE', vinculo: 'comunidade', unidade_id: null, unidade_nome: null, area: null, indicado_por: 'Carla', igreja: 'Igreja Batista', horario: 'pos_evento', opcao2: null }) as never]).replace('﻿', '').split('\r\n');
    expect(csv[0]).toBe('Protocolo;Quando;Nome;WhatsApp;Vínculo;Unidade;Indicado por;Igreja;Horário;1ª opção;2ª opção');
    expect(csv[1]).toMatch(/^VL-7K2Q9;.*;Leonardo Garbo Rodrigues;\(19\) 99355-8242;Funcionário\(a\) ANA;Grupo de Oração Esperança;;;Manhã;Cozinha \/ Servimento;Decoração$/);
    expect(csv[2]).toMatch(/;Voluntário\(a\);;Carla;Igreja Batista;Pós-evento;Cozinha \/ Servimento;$/);
  });
});

describe('formulário', () => {
  const abrir = () => render(<MemoryRouter><Voluntariado /></MemoryRouter>);
  const etapa2 = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Sim, posso participar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  };
  const quemSou = (vinculo: RegExp) => {
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'leonardo garbo rodrigues' } });
    fireEvent.change(screen.getByLabelText('Telefone (WhatsApp)'), { target: { value: '19993558242' } });
    fireEvent.click(screen.getByRole('button', { name: /^Manhã/ }));
    fireEvent.click(screen.getByRole('button', { name: vinculo }));
  };

  it('etapa 1: o convite, o aviso do treinamento e quem não pode para ali, sem gravar nada', () => {
    abrir();
    expect(screen.getByTestId('dia-do-evento')).toHaveTextContent('08/12 · Natal Feliz');
    const sobre = screen.getByTestId('sobre-o-evento');
    expect(sobre).toHaveTextContent('Neste Natal, seja o presente de alguém');
    expect(sobre).toHaveTextContent('em parceria com JNI e Nazateen');
    expect(sobre).not.toHaveTextContent('Hope Day');
    expect(screen.getByTestId('aviso-do-treinamento')).toHaveTextContent('obrigatório participar do Treinamento de Voluntários, no dia 28/11, no Recanto Maanaim');
    expect(screen.getByTestId('etapas')).toHaveTextContent('Etapa 1 de 3');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Não tenho disponibilidade' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByTestId('sem-treino')).toHaveTextContent('Obrigado pelo carinho!');
    expect(screen.queryByLabelText('Nome completo')).toBeNull();
    expect(banco.enviados).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar e mudar a resposta' }));
    expect(screen.getByTestId('aviso-do-treinamento')).toBeInTheDocument();
  });

  it('funcionário: unidade, as 6 áreas dele, protocolo, treinamento e comprovante', async () => {
    abrir();
    etapa2();
    expect(screen.getByTestId('etapas')).toHaveTextContent('Etapa 2 de 3');
    quemSou(/^Sou funcionário\(a\) da ANA/);
    // Sem a unidade, não segue.
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a unidade em que você trabalha.');
    const unidade = screen.getByLabelText('Em qual unidade você trabalha?') as HTMLSelectElement;
    expect([...unidade.options].map((o) => o.textContent)).not.toContain('ANA DIC');
    fireEvent.change(unidade, { target: { value: 'goe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByTestId('etapas')).toHaveTextContent('Etapa 3 de 3');
    expect(screen.getByText('Áreas para funcionários da ANA')).toBeInTheDocument();
    // Só as do dia do evento (23/10/2026).
    expect(screen.queryByRole('button', { name: /^Decoração/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Montagem/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Louvor Kids/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Presentes Kids/ })).toBeNull();
    const cozinha = screen.getByRole('button', { name: /^Cozinha \/ Servimento/ });
    expect(cozinha).toHaveTextContent('mais de 1.500 refeições');
    fireEvent.click(cozinha);
    fireEvent.click(screen.getByRole('button', { name: /^Estações/ }));
    expect(cozinha).toHaveTextContent('1ª');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar inscrição' }));

    expect(await screen.findByTestId('protocolo')).toHaveTextContent('VL-7K2Q9');
    expect(banco.planilhaPedida).toBe(1);
    expect(banco.enviados[0]).toMatchObject({ nome: 'leonardo garbo rodrigues', whatsapp: '(19) 99355-8242', horario: 'manha', vinculo: 'funcionario', unidadeId: 'goe', opcao1: 'cozinha', opcao2: 'estacoes', indicadoPor: null, igreja: null });
    const resumo = screen.getByTestId('resumo');
    expect(resumo).toHaveTextContent('Funcionário(a) ANA · Grupo de Oração Esperança');
    expect(resumo).toHaveTextContent('Manhã');
    expect(resumo).toHaveTextContent('Estações');
    // Sem "tire um print" e sem "a equipe entra em contato" (23/10/2026): o treinamento já aqui.
    expect(screen.queryByText(/print/)).toBeNull();
    expect(screen.queryByText(/entrar em contato/)).toBeNull();
    // O grupo do WhatsApp: entrada obrigatória, por botão (23/10/2026).
    expect(screen.getByTestId('grupo')).toHaveTextContent('entrada obrigatória');
    expect(screen.getByRole('link', { name: /Entrar no grupo do WhatsApp/ })).toHaveAttribute('href', 'https://chat.whatsapp.com/FnmKMVE3PXnEWKVYQY7ZEe');
    const treino = screen.getByTestId('treinamento');
    expect(treino).toHaveTextContent('Sábado, 28/11');
    expect(treino).toHaveTextContent('a confirmar');
    // Grafia com dois "a" e o endereço, que abre no Maps (23/10/2026).
    expect(treino).toHaveTextContent('Recanto Maanaim · mesmo local do Natal Feliz');
    expect(screen.getByTestId('endereco-do-treinamento')).toHaveTextContent('Rua Arcebispo Dom Luciano Mendes de Almeida, 50 - Swiss Park, Campinas - SP, 13049-446');
    expect(screen.getByTestId('endereco-do-treinamento').getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Recanto%20Maanaim/);
    expect(document.body.textContent).not.toMatch(/Manaim/);
    fireEvent.click(screen.getByRole('button', { name: /Baixar comprovante/ }));
    await waitFor(() => expect(banco.comprovantes).toHaveLength(1));
    expect(banco.comprovantes[0]).toMatchObject({ protocolo: 'VL-7K2Q9' });
    expect((banco.comprovantes[0].linhas as string[][]).map(([r]) => r)).toEqual(['Nome', 'Vínculo', 'Horário', '1ª opção', '2ª opção']);
  });

  it('nenhum dos dois: quem indicou (obrigatório se sim) e a igreja (opcional)', async () => {
    abrir();
    etapa2();
    quemSou(/^Nenhum dos dois/);
    expect(screen.queryByLabelText('Em qual unidade você trabalha?')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Conte se alguém da ANA te indicou.');
    fireEvent.click(screen.getAllByRole('button', { name: 'Sim' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escreva o nome de quem te indicou.');
    fireEvent.change(screen.getByLabelText('Nome de quem te indicou'), { target: { value: 'Carla' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Sim' })[1]);
    fireEvent.change(screen.getByLabelText(/Qual igreja/), { target: { value: 'Igreja Batista do Bairro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByText('Áreas abertas para voluntários')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Decoração/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Brinquedos infláveis/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar inscrição' }));
    await screen.findByTestId('protocolo');
    expect(banco.enviados[0]).toMatchObject({ vinculo: 'comunidade', unidadeId: null, indicadoPor: 'Carla', igreja: 'Igreja Batista do Bairro', opcao1: 'inflaveis', opcao2: null });
    expect(screen.getByTestId('resumo')).toHaveTextContent('Voluntário(a) · indicado(a) por Carla');
    expect(screen.getByTestId('resumo')).toHaveTextContent('Igreja Batista do Bairro');
  });

  it('Alcance JNI: segue direto para as 8 áreas dele', () => {
    abrir();
    etapa2();
    quemSou(/^Faço parte do Alcance JNI/);
    expect(screen.queryByLabelText('Em qual unidade você trabalha?')).toBeNull();
    expect(screen.queryByText('Alguém da ANA te indicou?')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Áreas para o Alcance JNI')).toBeInTheDocument();
    for (const a of ['Louvor Kids', 'Som', 'Recreação Kids', 'Presentes Kids']) expect(screen.getByRole('button', { name: new RegExp(`^${a}`) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Estações/ })).toBeNull();
  });

  it('área lotada: o aviso oferece a 2ª opção, e ela não vira 1ª', async () => {
    banco.lotadas = ['cozinha'];
    abrir();
    etapa2();
    quemSou(/^Faço parte do Alcance JNI/);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByTestId('lotada')).toHaveTextContent('Vagas preenchidas · só como 2ª opção');
    fireEvent.click(screen.getByRole('button', { name: /^Cozinha \/ Servimento/ }));
    const aviso = screen.getByRole('dialog');
    expect(aviso).toHaveTextContent('As vagas de Cozinha / Servimento já foram preenchidas');
    fireEvent.click(within(aviso).getByRole('button', { name: 'Marcar como 2ª opção' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /^Cozinha \/ Servimento/ })).toHaveTextContent('2ª');
    fireEvent.click(screen.getByRole('button', { name: /^Som/ }));
    expect(screen.getByRole('button', { name: /^Som/ })).toHaveTextContent('1ª');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar inscrição' }));
    await screen.findByTestId('protocolo');
    expect(banco.enviados[0]).toMatchObject({ opcao1: 'som', opcao2: 'cozinha' });
  });

  it('a vaga acaba enquanto a pessoa preenche: a área vira a 2ª opção', async () => {
    abrir();
    etapa2();
    quemSou(/^Faço parte do Alcance JNI/);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: /^Cozinha \/ Servimento/ }));
    banco.erro = 'area_lotada';
    fireEvent.click(screen.getByRole('button', { name: 'Enviar inscrição' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('As vagas de Cozinha / Servimento acabaram de ser preenchidas');
    expect(screen.getByRole('button', { name: /^Cozinha \/ Servimento/ })).toHaveTextContent('2ª');
  });

  it('WhatsApp já inscrito: explica o que fazer', async () => {
    banco.erro = 'ja_inscrito';
    abrir();
    etapa2();
    quemSou(/^Faço parte do Alcance JNI/);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: /^Som/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar inscrição' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Este WhatsApp já está inscrito. Para mudar a área, fale com a equipe.');
  });
});

describe('painel', () => {
  it('conta por área (1ª opção /meta, +2ª ao lado), marca as vazias e filtra por área', async () => {
    banco.metas = { cozinha: 25 };
    banco.lista = [I({}), I({ id: 'i2', protocolo: 'VL-ABCDE', nome: 'Ana Paula', unidade_id: 'cei-pierre-weil', unidade_nome: 'CEI Bem Querer Prof. Pierre Weil', opcao1: 'decoracao', opcao2: null })];
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    expect(await screen.findAllByTestId('inscricao')).toHaveLength(2);
    expect(screen.getByTestId('kpi-Inscritos')).toHaveTextContent('2');
    // As 7 do formulário e a Decoração, que alguém já escolheu; com gente: Cozinha e Decoração.
    expect(screen.getByTestId('kpi-Áreas sem ninguém')).toHaveTextContent('6');
    const decoracao = screen.getAllByTestId('barra-area').find((b) => b.textContent?.startsWith('Decoração'))!;
    expect(decoracao).toHaveTextContent('Decoração1 +1');
    await waitFor(() => expect(screen.getAllByTestId('barra-area').find((b) => b.textContent?.startsWith('Cozinha'))).toHaveTextContent('1/25'));
    fireEvent.click(decoracao);
    expect(screen.getAllByTestId('inscricao')).toHaveLength(2); // as duas têm Decoração (1ª ou 2ª)
    fireEvent.click(screen.getAllByTestId('barra-area').find((b) => b.textContent?.startsWith('Cozinha'))!);
    expect(screen.getAllByTestId('inscricao')).toHaveLength(1);
    expect(within(screen.getByTestId('inscricao')).getByRole('link', { name: '(19) 99355-8242' })).toHaveAttribute('href', 'https://wa.me/5519993558242');
  });

  it('o vínculo, a indicação e o horário na lista; o filtro também por vínculo', async () => {
    banco.lista = [I({}), I({ id: 'i2', protocolo: 'VL-ABCDE', nome: 'Bruna Teixeira', vinculo: 'comunidade', unidade_id: null, unidade_nome: null, area: null, indicado_por: 'Carla', igreja: 'Igreja Batista', horario: 'tarde' }), I({ id: 'i3', protocolo: 'VL-JNI22', nome: 'Marcos Souza', vinculo: 'alcance', unidade_id: null, unidade_nome: null, area: null, horario: 'dia_todo', opcao1: 'som' })];
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    await screen.findAllByTestId('inscricao');
    const bruna = screen.getAllByTestId('inscricao').find((l) => l.textContent?.includes('Bruna'))!;
    expect(bruna).toHaveTextContent('Voluntário(a)');
    expect(bruna).toHaveTextContent('indicado(a) por Carla · Igreja Batista');
    expect(bruna).toHaveTextContent('Tarde');
    fireEvent.click(screen.getByRole('button', { name: 'Alcance JNI' }));
    expect(screen.getAllByTestId('inscricao')).toHaveLength(1);
    expect(screen.getByTestId('inscricao')).toHaveTextContent('Marcos Souza');
    expect(screen.getByTestId('kpi-Unidades')).toHaveTextContent('0');
  });

  it('as metas por área: mostra a lotada e salva só o que mudou', async () => {
    banco.metas = { cozinha: 1 };
    banco.lista = [I({})];
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    const metas = await screen.findByTestId('metas-por-area');
    await waitFor(() => expect(within(metas).getByLabelText('Meta de Cozinha / Servimento')).toHaveValue('1'));
    expect(within(metas).getByText('lotada')).toBeInTheDocument();
    fireEvent.change(within(metas).getByLabelText('Meta de Cozinha / Servimento'), { target: { value: '25' } });
    fireEvent.change(within(metas).getByLabelText('Meta de Som'), { target: { value: '4' } });
    fireEvent.click(within(metas).getByRole('button', { name: 'Salvar metas' }));
    await waitFor(() => expect(banco.metasSalvas).toEqual([['cozinha', 25], ['som', 4]]));
  });

  it('filtra por unidade, baixa a planilha e apaga com confirmação', async () => {
    banco.lista = [I({}), I({ id: 'i2', protocolo: 'VL-ABCDE', nome: 'Ana Paula', unidade_id: 'cei-pierre-weil', unidade_nome: 'CEI Bem Querer Prof. Pierre Weil' })];
    render(<MemoryRouter><PainelDoVoluntariado /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'CEI Bem Querer Prof. Pierre Weil' }));
    expect(screen.getAllByTestId('inscricao')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Baixar planilha/ }));
    expect(banco.baixados[0]).toMatch(/^voluntariado-natal-feliz-cei-pierre-weil-/);
    fireEvent.click(screen.getByRole('button', { name: 'Apagar VL-ABCDE' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(banco.apagados).toEqual(['i2']));
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
