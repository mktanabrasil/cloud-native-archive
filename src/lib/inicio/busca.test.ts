import { describe, expect, it } from 'vitest';
import {
  buscarEventos, buscarJornais, buscarPaginas, dataPorExtenso, linkDoEvento, linkDoJornal, marcarTermo,
  normalizar, proximosEventos, saudacao, type EventoDaBusca, type QuemBusca,
} from './busca';

/** A busca da página inicial (17/11/2026). */
const MARKETING: QuemBusca = { soEducacao: false, canAccessJournal: true, temCalendario: true, veVagas: true, isMarketing: true };
const GESTORA_DO_SOCIAL: QuemBusca = { soEducacao: false, canAccessJournal: false, temCalendario: true, veVagas: false, isMarketing: false };
const DIRECAO_DE_CEI: QuemBusca = { soEducacao: true, canAccessJournal: true, temCalendario: false, veVagas: false, isMarketing: false };
const titulos = (r: { titulo: string }[]) => r.map((p) => p.titulo);

describe('as páginas', () => {
  it('acha sem acento e sem caixa', () => {
    expect(titulos(buscarPaginas('calendario', MARKETING))).toEqual(['Calendário de eventos', 'Calendário Anual']);
    expect(normalizar('Calendário ANUAL')).toBe('calendario anual');
  });

  it('acha pelas outras palavras: "senha" leva ao perfil (ou ao Painel, no marketing)', () => {
    expect(titulos(buscarPaginas('senha', GESTORA_DO_SOCIAL))).toEqual(['Meu perfil']);
    expect(titulos(buscarPaginas('senha', MARKETING))).toEqual(['Painel']);
  });

  it('cada pessoa só acha as páginas que vê', () => {
    expect(buscarPaginas('pizza', GESTORA_DO_SOCIAL)).toEqual([]);
    expect(titulos(buscarPaginas('pizza', MARKETING))).toEqual(['Pizza da Alegria']);
    expect(buscarPaginas('jornal', GESTORA_DO_SOCIAL)).toEqual([]);
    expect(buscarPaginas('eventos', DIRECAO_DE_CEI)).toEqual([]);
    expect(titulos(buscarPaginas('jornais', DIRECAO_DE_CEI))).toEqual(['Jornais das unidades', 'Jornal Institucional']);
    expect(buscarPaginas('vagas', GESTORA_DO_SOCIAL)).toEqual([]);
  });

  it('o Calendário Anual só para quem o tem', () => {
    expect(titulos(buscarPaginas('anual', { ...GESTORA_DO_SOCIAL, temCalendario: false }))).toEqual([]);
    expect(titulos(buscarPaginas('anual', GESTORA_DO_SOCIAL))).toEqual(['Calendário Anual']);
  });

  it('todas as palavras precisam aparecer', () => {
    expect(titulos(buscarPaginas('natal voluntario', MARKETING))).toEqual(['Voluntariado']);
    expect(buscarPaginas('natal pizza', MARKETING)).toEqual([]);
  });

  it('busca vazia não acha nada', () => {
    expect(buscarPaginas('   ', MARKETING)).toEqual([]);
  });
});

const ev = (id: string, title: string, inicio: string, extra: Partial<EventoDaBusca> = {}): EventoDaBusca => ({
  id, title, unit: 'DIC', location: 'Quadra', start_datetime: inicio, end_datetime: inicio, status: 'confirmado', visibility: 'publico', slug: null, ...extra,
});
const HOJE = new Date('2026-11-17T12:00:00');

describe('os eventos', () => {
  const lista = [
    ev('passado', 'Festa de outubro', '2026-10-20T15:00:00'),
    ev('natal', 'Natal Feliz 2026', '2026-12-08T09:00:00', { unit: 'Administração', visibility: 'interno' }),
    ev('karate', 'Karatê no Santana', '2026-11-22T09:00:00', { unit: 'Santana' }),
    ev('cancelado', 'Passeio', '2026-11-20T09:00:00', { status: 'cancelado' }),
    ev('apagado', 'Apagado', '2026-11-21T09:00:00', { deleted_at: '2026-11-01' }),
    ev('hoje', 'Reunião de hoje', '2026-11-17T08:00:00', { end_datetime: '2026-11-17T18:00:00' }),
  ];

  it('próximos: os que ainda vão acontecer (ou estão acontecendo), sem cancelado nem apagado', () => {
    expect(proximosEventos(lista, HOJE).map((e) => e.id)).toEqual(['hoje', 'karate', 'natal']);
  });

  it('na busca, os que vêm primeiro, depois os que já foram', () => {
    expect(buscarEventos('a', lista, HOJE).map((e) => e.id)).toEqual(['hoje', 'cancelado', 'karate', 'natal']);
    expect(buscarEventos('festa', lista, HOJE).map((e) => e.id)).toEqual(['passado']);
  });

  it('acha pela unidade e pela data', () => {
    expect(buscarEventos('santana', lista, HOJE).map((e) => e.id)).toEqual(['karate']);
    expect(buscarEventos('08/12', lista, HOJE).map((e) => e.id)).toEqual(['natal']);
  });

  it('o link abre o detalhe na programação, pelo slug ou pelo id', () => {
    expect(linkDoEvento({ id: 'abc', slug: 'natal-feliz' })).toBe('/social/eventos?slug=natal-feliz');
    expect(linkDoEvento({ id: 'abc', slug: null })).toBe('/social/eventos?slug=abc');
  });
});

describe('os jornais', () => {
  const jornais = [
    { id: '1', name: 'Jornal Calmon — Novembro 2026', unit_id: 'cei-calmon', status: 'finalizado', reference_month: 'Novembro 2026', updated_at: '2026-11-14' },
    { id: '2', name: 'Jornal Anísio — Outubro 2026', unit_id: 'cei-anisio-spinola', status: 'rascunho', reference_month: 'Outubro 2026', updated_at: '2026-11-10' },
    { id: '3', name: 'Jornal antigo', unit_id: 'cei-calmon', status: 'arquivado', reference_month: null, updated_at: '2026-01-01' },
  ];
  const unidade = (id: string | null) => (id === 'cei-calmon' ? 'CEI Bem Querer Sen. João de Medeiros Calmon' : 'CEI Bem Querer Prof. Anísio Spínola');

  it('pelo nome, pela unidade e pelo mês; arquivado fica de fora', () => {
    expect(buscarJornais('anisio', jornais, unidade).map((j) => j.id)).toEqual(['2']);
    expect(buscarJornais('medeiros', jornais, unidade).map((j) => j.id)).toEqual(['1']);
    expect(buscarJornais('jornal', jornais, unidade).map((j) => j.id)).toEqual(['1', '2']);
  });

  it('o link abre o jornal no Jornal Institucional, na unidade dele', () => {
    expect(linkDoJornal({ id: '1', unit_id: 'cei-calmon' })).toBe('/educacao/jornal?unidade=cei-calmon&abrir=1');
    expect(linkDoJornal({ id: '9', unit_id: null })).toBe('/educacao/jornal?unidade=geral&abrir=9');
  });
});

describe('o resto', () => {
  it('marca o termo no texto original, mesmo com acento', () => {
    expect(marcarTermo('Calendário Anual', 'calendario')).toEqual(['', 'Calendário', ' Anual']);
    expect(marcarTermo('Espetáculo de Natal', 'natal')).toEqual(['Espetáculo de ', 'Natal', '']);
    expect(marcarTermo('Voluntariado', 'natal')).toEqual(['Voluntariado', '', '']);
  });

  it('a saudação pela hora', () => {
    expect(saudacao(new Date('2026-11-17T08:00:00'))).toBe('Bom dia');
    expect(saudacao(new Date('2026-11-17T14:00:00'))).toBe('Boa tarde');
    expect(saudacao(new Date('2026-11-17T20:00:00'))).toBe('Boa noite');
    expect(saudacao(new Date('2026-11-17T02:00:00'))).toBe('Boa noite');
  });

  it('a data por extenso, com maiúscula', () => {
    expect(dataPorExtenso(new Date('2026-11-17T12:00:00'))).toBe('Terça-feira, 17 de novembro');
  });
});
