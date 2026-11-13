import { describe, expect, it } from 'vitest';
import { andamento, autoriaDe, autoriaDoItem, chaveDoDia, diaDaSemana, itensDoDia, percursosCompletos, rotuloDasUnidades, semanasDoMes, tituloDoMes, vaiProPdf, type AnoDoCalendario, type ItemDoCalendario } from './regras';
import { destinoDaContaRestrita, ehContaRestrita } from '@/lib/contasRestritas';

/** O Calendário Anual (14/11/2026): as regras sem banco. */

const item = (o: Partial<ItemDoCalendario>): ItemDoCalendario => ({ id: Math.random().toString(36), ano: 2027, dia: '2027-02-09', texto: 'X', tipo: 'data', unidades: [], destaque: true, oculto: false, fonte: null, ...o });

describe('o mês', () => {
  it('fevereiro de 2027 começa na segunda e tem 4 semanas e um domingo', () => {
    const s = semanasDoMes(2027, 2);
    expect(s[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
    expect(s).toHaveLength(5);
    expect(s[4][0]).toBe(28);
  });
  it('a chave do dia e o dia da semana, sem fuso', () => {
    expect(chaveDoDia(2027, 2, 9)).toBe('2027-02-09');
    expect(diaDaSemana('2027-02-08')).toBe(1); // segunda de Carnaval
    expect(diaDaSemana('2027-12-25')).toBe(6); // Natal num sábado
  });
});

describe('os itens do dia', () => {
  it('na ordem do PDF: feriado, datas, atividades', () => {
    const lista = [item({ tipo: 'atividade', texto: 'C' }), item({ tipo: 'data', texto: 'B' }), item({ tipo: 'feriado', texto: 'A' }), item({ dia: '2027-02-10', texto: 'outro dia' })];
    expect(itensDoDia(lista, '2027-02-09').map(i => i.texto)).toEqual(['A', 'B', 'C']);
  });
  it('a data escondida não vai para o PDF; o feriado e a atividade vão', () => {
    expect(vaiProPdf(item({ tipo: 'data', oculto: true }))).toBe(false);
    expect(vaiProPdf(item({ tipo: 'data' }))).toBe(true);
    expect(vaiProPdf(item({ tipo: 'atividade', oculto: true }))).toBe(true);
  });
  it('as unidades: vazio ou as três = todas', () => {
    expect(rotuloDasUnidades([])).toBe('Todas as unidades');
    expect(rotuloDasUnidades(['DIC', 'Nilópolis', 'Santana'])).toBe('Todas as unidades');
    expect(rotuloDasUnidades(['Santana'])).toBe('Santana');
  });
});

describe('percursos e andamento', () => {
  const base: AnoDoCalendario = { ano: 2027, tema: '', percursos: [{ mes: 2, tema: 'Cultivando o amor e o respeito', sugestoes: 'Boas-vindas' }], textos: {}, meses_revisados: [1, 2, 2], capa_url: null, status: 'preenchimento', observacao: null, enviado_em: null, enviado_por: null, aprovado_em: null, aprovado_por: null, pdf_url: null, atualizado_em: '', atualizado_por: null };
  it('os 12 meses, completando os que faltam', () => {
    const p = percursosCompletos(base.percursos);
    expect(p).toHaveLength(12);
    expect(p[1].tema).toBe('Cultivando o amor e o respeito');
    expect(p[0]).toEqual({ mes: 1, tema: '', sugestoes: '' });
  });
  it('o título da página do mês, como no PDF', () => {
    expect(tituloDoMes(2027, 2, base.percursos)).toBe('Fevereiro 2027 - Cultivando o amor e o respeito');
    expect(tituloDoMes(2027, 3, base.percursos)).toBe('Março 2027');
  });
  it('o andamento: tema, percursos preenchidos e meses revisados sem repetir', () => {
    expect(andamento(base)).toEqual({ tema: false, percursos: 1, meses: 2 });
  });
});

describe('as contas que não são equipe', () => {
  it('candidato vai para a área dele; a do calendário, para /calendario; a equipe, para nenhum lugar', () => {
    expect(destinoDaContaRestrita({ user_metadata: { conta: 'candidato' } })).toBe('/vagas/minha-area');
    expect(destinoDaContaRestrita({ user_metadata: { conta: 'calendario' } })).toBe('/calendario');
    expect(destinoDaContaRestrita({ user_metadata: {} })).toBeNull();
    expect(ehContaRestrita({ user_metadata: { conta: 'calendario' } })).toBe(true);
    expect(ehContaRestrita(null)).toBe(false);
  });
});

describe('autoria (13/11/2026)', () => {
  const item = (c: Partial<ItemDoCalendario>): ItemDoCalendario => ({ id: 'x', ano: 2027, dia: '2027-03-01', texto: 'Reunião', tipo: 'atividade', unidades: [], destaque: true, oculto: false, fonte: null, ...c });

  it('a parte do ano: nome e dia, no horário de Brasília', () => {
    expect(autoriaDe({ autoria: { tema: { nome: 'Gestão DIC', em: '2026-11-14T02:30:00Z' } } }, 'tema')).toBe('Gestão DIC · 13/11');
    expect(autoriaDe({ autoria: {} }, 'tema')).toBeNull();
    expect(autoriaDe({}, 'tema')).toBeNull();
  });

  it('a atividade: quem acrescentou e quem mexeu por último; a base não tem autora', () => {
    expect(autoriaDoItem(item({ criado_por_nome: 'Gestão DIC', criado_em: '2026-11-13T15:00:00Z' }))).toBe('Por Gestão DIC · 13/11');
    expect(autoriaDoItem(item({ criado_por_nome: 'Gestão DIC', criado_em: '2026-11-13T15:00:00Z', alterado_por_nome: 'MKT ANA', alterado_em: '2026-11-15T15:00:00Z' })))
      .toBe('Por Gestão DIC · 13/11 · editado por MKT ANA · 15/11');
    expect(autoriaDoItem(item({ tipo: 'data', alterado_por_nome: 'Gestão DIC', alterado_em: '2026-11-15T15:00:00Z' }))).toBe('Editado por Gestão DIC · 15/11');
    expect(autoriaDoItem(item({ tipo: 'feriado' }))).toBeNull();
  });
});
