import { describe, expect, it } from 'vitest';
import { SITUACOES_DO_EMAIL, emailDaResposta, type RespostaDoEmail } from '../../../supabase/functions/feedback-aviso/email';
import { SITUACOES_DO_FEEDBACK, contarPorSituacao, filtrarCaixa, naoLidos, quandoCurto, setoresDaCaixa, type FeedbackDaCaixa } from './regras';

/** A caixa de feedback no Painel e o e-mail da resposta (PR 2, 23/11/2026). */
const base: FeedbackDaCaixa = {
  id: 'f1', autor_id: 'u1', autor_nome: 'Gestão Santana', autor_email: 'santana@anabrasil.org', tipo: 'falta',
  texto: 'Ver só a minha unidade', setor: 'Social', pagina: 'Calendário Anual', caminho: '/social/calendario', aparelho: 'celular', navegador: 'Chrome',
  print_path: null, situacao: 'novo', resposta: null, respondido_por: null, respondido_em: null, lido_em: null,
  criado_em: '2026-11-23T13:42:00Z', atualizado_em: '2026-11-23T13:42:00Z',
};
const LISTA: FeedbackDaCaixa[] = [
  base,
  { ...base, id: 'f2', tipo: 'erro', setor: 'Educação', pagina: 'Semanário', situacao: 'analise', lido_em: '2026-11-23T14:00:00Z' },
  { ...base, id: 'f3', tipo: 'ideia', setor: null, pagina: null, situacao: 'feito', lido_em: '2026-11-23T14:00:00Z' },
  { ...base, id: 'f4', tipo: 'falta', situacao: 'novo' },
];

describe('a caixa', () => {
  it('conta por situação e os não lidos', () => {
    expect(contarPorSituacao(LISTA)).toEqual({ todos: 4, novo: 2, analise: 1, feito: 1, nao: 0 });
    expect(naoLidos(LISTA)).toBe(2);
  });

  it('filtra por situação, setor e tipo juntos', () => {
    const todos = { situacao: 'todos', setor: 'todos', tipo: 'todos' } as const;
    expect(filtrarCaixa(LISTA, todos).map(f => f.id)).toEqual(['f1', 'f2', 'f3', 'f4']);
    expect(filtrarCaixa(LISTA, { ...todos, situacao: 'novo' }).map(f => f.id)).toEqual(['f1', 'f4']);
    expect(filtrarCaixa(LISTA, { ...todos, setor: 'Educação' }).map(f => f.id)).toEqual(['f2']);
    expect(filtrarCaixa(LISTA, { ...todos, setor: 'Fora dos setores' }).map(f => f.id)).toEqual(['f3']);
    expect(filtrarCaixa(LISTA, { situacao: 'novo', setor: 'Social', tipo: 'falta' }).map(f => f.id)).toEqual(['f1', 'f4']);
  });

  it('os setores do filtro, em ordem', () => {
    expect(setoresDaCaixa(LISTA)).toEqual(['Educação', 'Fora dos setores', 'Social']);
  });

  it('data curta no fuso de Brasília', () => {
    expect(quandoCurto('2026-11-23T13:42:00Z')).toBe('23/11, 10:42');
  });
});

describe('o e-mail da resposta', () => {
  const SITE = 'https://app.anabrasil.org';
  const r: RespostaDoEmail = { ...base, situacao: 'feito', resposta: 'Feito! Já dá para filtrar\npela unidade.', respondido_por: 'MKT ANA' };

  it('os nomes das situações batem com os do app', () => {
    for (const [id, nome] of Object.entries(SITUACOES_DO_FEEDBACK)) expect(SITUACOES_DO_EMAIL[id].nome).toBe(nome);
  });

  it('assunto com a situação; corpo com a resposta, o texto original e onde', () => {
    const m = emailDaResposta(r, SITE);
    expect(m.assunto).toBe('Seu feedback: Feito · Ver só a minha unidade');
    expect(m.html).toContain('RESPOSTA DE MKT ANA');
    expect(m.html).toContain('Feito! Já dá para filtrar<br>pela unidade.');
    expect(m.html).toContain('Ver só a minha unidade');
    expect(m.texto).toContain('Resposta de MKT ANA:');
    expect(m.texto).toContain('Onde: Social › Calendário Anual');
    expect(m.texto).toContain('O que você pediu foi feito.');
  });

  it('sem resposta, só a situação', () => {
    const m = emailDaResposta({ ...r, situacao: 'analise', resposta: null }, SITE);
    expect(m.assunto.startsWith('Seu feedback: Em análise')).toBe(true);
    expect(m.html).not.toContain('RESPOSTA DE');
    expect(m.texto).toContain('O marketing está analisando o seu feedback.');
  });

  it('escapa a resposta', () => {
    expect(emailDaResposta({ ...r, resposta: '<b>oi</b>' }, SITE).html).toContain('&lt;b&gt;oi&lt;/b&gt;');
  });
});
