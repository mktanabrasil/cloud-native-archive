import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const { paraVaga } = await import('./api');
const { calcularRelatorio, csvDoRelatorio, emDias, mediana } = await import('./relatorios');
const { agruparSeguidos, textoDoRegistro } = await import('./auditoria');

/** Passo 6 do roteiro (20/10/2026): relatórios em volumes e tempos; auditoria legível. */

const AGORA = new Date('2026-10-20T12:00:00Z').getTime();
const d = (dias: number, horas = 0) => new Date(AGORA - dias * 864e5 + horas * 36e5).toISOString();

const vagas = [
  paraVaga({ id: 'v1', slug: 'educador', titulo: 'Educador Social', codigo: 'SOC-1', area: 'social', status: 'publicada', responsavel_id: 'p1' }),
  paraVaga({ id: 'v2', slug: 'aux', titulo: 'Auxiliar Administrativo', codigo: 'ADM-1', area: 'administracao', status: 'publicada', responsavel_id: null }),
  paraVaga({ id: 'v3', slug: 'cozinha', titulo: 'Cozinheira', codigo: 'SOC-2', area: 'social', status: 'encerrada', responsavel_id: 'p1', updated_at: d(3) }),
];
const C = (id: string, vaga: string, criada: number, o: Record<string, unknown> = {}) => ({ id, vaga_id: vaga, etapa: 'recebida', resultado: null, aberta_em: null, retirada_em: null, created_at: d(criada), origem: 'Instagram', ...o });
const candidaturas = [
  // 4 no período de 30 dias
  C('a', 'v1', 20, { etapa: 'entrevista', aberta_em: d(19) }),
  C('b', 'v1', 10, { etapa: 'analise', aberta_em: d(7), origem: 'Indicação' }),
  C('c', 'v3', 25, { etapa: 'resultado', resultado: 'aprovado', aberta_em: d(24) }),
  C('e', 'v2', 5, { retirada_em: d(4), origem: null }),
  // 2 no período anterior (30–60 dias)
  C('x', 'v1', 40, { aberta_em: d(36) }),
  C('y', 'v1', 45, { aberta_em: d(41) }),
];
const H = (c: string, de: string, para: string, dias: number) => ({ candidatura_id: c, acao: 'etapa', de, para, em: d(dias) });
const historico = [
  H('a', 'recebida', 'analise', 19), H('a', 'analise', 'entrevista', 15),
  H('b', 'recebida', 'analise', 7),
  H('c', 'recebida', 'analise', 24), H('c', 'analise', 'entrevista', 22), H('c', 'entrevista', 'resultado:aprovado', 13),
];
const mensagens = [
  { id: 'm1', candidatura_id: 'a', autor: 'equipe', tipo: 'convite', responde_a: null, created_at: d(15) },
  { id: 'r1', candidatura_id: 'a', autor: 'candidato', tipo: 'resposta', responde_a: 'm1', created_at: d(15, 12) },
];
const dados = { vagas, candidaturas, historico, mensagens, nomes: new Map([['p1', 'Viviane']]) };

describe('relatórios', () => {
  const r = calcularRelatorio(dados, { dias: 30, area: null, vaga: null }, AGORA);

  it('mediana em dias, com uma casa', () => {
    expect(mediana([])).toBeNull();
    expect(mediana([5, 1, 3])).toBe(3);
    expect(mediana([1, 2, 3, 10])).toBe(2.5);
    expect(emDias(2.4)).toBe('2,4 d');
    expect(emDias(null)).toBe('—');
  });

  it('conta o período e compara com o anterior', () => {
    expect(r.candidaturas).toBe(4);
    expect(r.candidaturasAntes).toBe(2);
    // 1ª olhada: a=1, b=3, c=1 → mediana 1; antes: x=4, y=4
    expect(r.primeiraOlhada).toBe(1);
    expect(r.primeiraOlhadaAntes).toBe(4);
    expect(r.ateResultado).toBe(12);
    expect(r.aprovados).toBe(1);
    expect(r.vagasFechadas).toBe(1);
  });

  it('funil pelo ponto mais longe que cada um chegou; retiradas à parte', () => {
    expect(r.funil).toEqual({ recebidas: 4, analise: 3, entrevista: 2, aprovadas: 1, retiradas: 1 });
  });

  it('tempo em cada etapa (só estadias terminadas) e convite → resposta', () => {
    const t = Object.fromEntries(r.tempos.map((x) => [x.rotulo, x.dias]));
    expect(t['Análise']).toBe(3); // a: 4 dias, c: 2 dias
    expect(t['Entrevista']).toBe(9); // só c terminou
    expect(t['Convite → resposta']).toBe(0.5);
  });

  it('origem em porcentagem, sem informar vira "Não informado"', () => {
    expect(r.origem).toEqual([
      { rotulo: 'Instagram', n: 2, pct: 50 },
      { rotulo: 'Indicação', n: 1, pct: 25 },
      { rotulo: 'Não informado', n: 1, pct: 25 },
    ]);
  });

  it('semanas: uma barra por semana do período', () => {
    expect(r.semanas).toHaveLength(5);
    expect(r.semanas.reduce((s, x) => s + x.n, 0)).toBe(4 + 0); // 30 dias = 5 semanas = 35 dias, nada de 40+
  });

  it('por vaga: responsável pelo nome e situação', () => {
    const por = Object.fromEntries(r.porVaga.map((l) => [l.vaga.id, l]));
    expect(por.v1).toMatchObject({ candidaturas: 2, emAberto: 4, responsavel: 'Viviane', situacao: 'triagem_lenta' });
    expect(por.v2).toMatchObject({ candidaturas: 1, emAberto: 0, responsavel: null, situacao: 'sem_responsavel' });
    expect(por.v3).toMatchObject({ aprovados: 1, situacao: 'fechada' });
  });

  it('filtrar por área tira as outras vagas', () => {
    const s = calcularRelatorio(dados, { dias: 30, area: 'administracao', vaga: null }, AGORA);
    expect(s.candidaturas).toBe(1);
    expect(s.porVaga.map((l) => l.vaga.id)).toEqual(['v2']);
  });

  it('"Tudo" não compara com período anterior', () => {
    const s = calcularRelatorio(dados, { dias: null, area: null, vaga: null }, AGORA);
    expect(s.candidaturas).toBe(6);
    expect(s.candidaturasAntes).toBeNull();
  });

  it('a planilha só tem números por vaga, nunca candidato', () => {
    const csv = csvDoRelatorio(r);
    expect(csv).toContain('Educador Social;SOC-1;Social;2;4;');
    expect(csv).not.toMatch(/Instagram|leo@|protocolo/i);
  });
});

describe('auditoria', () => {
  const R = (id: number, em: string, o: Record<string, unknown> = {}) => ({ id, em, quem: 'p2', quem_nome: 'Roberta', papel: 'rh', acao: 'curriculo.aberto', candidatura_id: null, protocolo: `P${id}`, vaga_id: 'v1', vaga_titulo: 'Educador Social', detalhe: null, ...o });

  it('junta aberturas seguidas da mesma pessoa na mesma vaga', () => {
    const lista = [
      R(5, '2026-10-16T22:20:00Z'), R(4, '2026-10-16T22:15:00Z'), R(3, '2026-10-16T22:10:00Z'),
      R(2, '2026-10-16T21:00:00Z'), // passou de 15 min: nova linha
      R(1, '2026-10-16T20:59:00Z', { acao: 'candidato.movido', detalhe: 'analise → entrevista' }),
    ];
    const g = agruparSeguidos(lista);
    expect(g.map((x) => x.vezes)).toEqual([3, 1, 1]);
    expect(g[0].em).toBe('2026-10-16T22:10:00Z');
    expect(g[0].ate).toBe('2026-10-16T22:20:00Z');
    expect(g[0].protocolo).toBeNull();
  });

  it('frases legíveis para cada ação', () => {
    expect(textoDoRegistro({ acao: 'candidato.movido', detalhe: 'analise → resultado:aprovado' })).toBe('Moveu Análise → Aprovado');
    expect(textoDoRegistro({ acao: 'mensagem.enviada', detalhe: 'convite' })).toBe('Enviou convite para entrevista');
    expect(textoDoRegistro({ acao: 'vaga.status', detalhe: 'publicada → pausada' })).toBe('Mudou a vaga: publicada → pausada');
    expect(textoDoRegistro({ acao: 'responsavel.nomeado', detalhe: 'sem responsável' })).toBe('Tirou o responsável');
    expect(textoDoRegistro({ acao: 'planilha.baixada', detalhe: '36 linhas' })).toBe('Baixou a planilha de candidatos (36 linhas)');
  });
});
