import { describe, expect, it } from 'vitest';
import { decidir, fichaDeImpressao, formatosPara, gerarFrase, resumoDoPedido } from './motor';
import { PEDIDO_VAZIO, type Pedido } from './modelo';

const pedido = (p: Partial<Pedido>): Pedido => ({ ...PEDIDO_VAZIO, ...p });

/**
 * O teste de mesa do motor: 10 artes aprovadas, com as respostas que a
 * gestora daria, e a família de onde cada uma saiu. Mudou um peso, confere aqui.
 */
describe('o motor acerta as artes já feitas', () => {
  const casos: [string, Partial<Pedido>, string][] = [
    ['Menopausa · Dic', { conta: 'evento', publico: 'mulheres', uso: 'os_dois', plastificar: 'nao', copias: 30, publica: ['story', 'feed'] }, 'convite'],
    ['Almoço · Pessoa Idosa', { conta: 'evento', publico: 'idosos', uso: 'digital', publica: ['grupo'] }, 'convite'],
    ['Reunião Extraordinária', { conta: 'evento', publico: 'familias', uso: 'digital', publica: ['grupo'] }, 'convite'],
    ['Dia das Crianças', { conta: 'evento', publico: 'criancas', uso: 'digital', publica: ['grupo'] }, 'infantil'],
    ['Semana Maluca', { conta: 'dias', publico: 'criancas', uso: 'impressa', plastificar: 'nao', copias: 5 }, 'infantil'],
    ['Semana da Infância', { conta: 'dias', publico: 'familias', uso: 'digital', publica: ['grupo'] }, 'cronograma'],
    ['Convocação · Social', { conta: 'evento', publico: 'equipe', uso: 'digital', publica: ['grupo'] }, 'convocacao'],
    ['Nossos Combinados', { conta: 'regras', publico: 'jovens', uso: 'impressa', plastificar: 'sim', copias: 1 }, 'cartaz'],
    ['Placas · Refeitório', { conta: 'placa', publico: 'criancas', uso: 'impressa', plastificar: 'sim', copias: 13 }, 'placa'],
    ['Trilhando · campanha', { conta: 'doacao', publico: 'empresas', uso: 'os_dois', plastificar: 'nao', copias: 10, publica: ['feed'] }, 'campanha'],
  ];
  it.each(casos)('%s', (_nome, r, esperado) => { expect(decidir(pedido(r)).top).toBe(esperado) });

  it('empate vira uma pergunta fixa; ficha e adesivo não oferecem outra família', () => {
    const d = decidir(pedido({ conta: 'dias', publico: 'criancas', uso: 'impressa' }));
    expect(d.desempate?.q).toMatch(/lúdico/); expect(d.desempate?.sim).toBe('infantil'); expect(d.desempate?.nao).toBe('cronograma');
    expect(decidir(pedido({ conta: 'ficha', publico: 'equipe', uso: 'impressa' })).travada).toBe(true);
  });
});

describe('formatos e impressão', () => {
  it('só digital gera feed e story; impressa gera A4; os dois gera tudo', () => {
    expect(formatosPara('convite', pedido({ uso: 'digital', publica: ['story'] }))).toEqual(['story']); // só story: não gera feed à toa
    expect(formatosPara('convite', pedido({ uso: 'digital', publica: ['grupo', 'story'] }))).toEqual(['4x5', 'story']);
    expect(formatosPara('convite', pedido({ uso: 'impressa' }))).toEqual(['a4r']);
    expect(formatosPara('convite', pedido({ uso: 'os_dois', publica: ['feed', 'story'] }))).toEqual(['4x5', 'story', 'a4r']);
    expect(formatosPara('infantil', pedido({ uso: 'impressa', dados: { atracoes: ['a', 'b', 'c'] } }))).toEqual(['a4p']);
  });
  it('a ficha propõe o tamanho e conta as folhas', () => {
    expect(fichaDeImpressao('convite', pedido({ uso: 'digital' }))).toBeNull();
    const f = fichaDeImpressao('convite', pedido({ uso: 'impressa', copias: 30, plastificar: 'nao' }))!;
    expect(f.tamanho).toMatch(/4 por folha/); expect(f.folhas).toBe(8);
    const p = fichaDeImpressao('placa', pedido({ uso: 'impressa', copias: 2, plastificar: 'sim', dados: { placas: [['a', ''], ['b', ''], ['c', '']] } }))!;
    expect(p.tamanho).toBe('A4 deitado'); expect(p.folhas).toBe(6); expect(p.obs).toMatch(/Ajustar/);
  });
});

describe('frase e resumo', () => {
  it('gera a frase no tom do público, dentro do limite, e alterna versões', () => {
    const a = gerarFrase('almoço do dia da pessoa idosa, com música', 'idosos', 0); const b = gerarFrase('almoço do dia da pessoa idosa, com música', 'idosos', 1);
    expect(a).toMatch(/^Um dia para celebrar/); expect(b).not.toBe(a); expect(a.length).toBeLessThanOrEqual(120);
    expect(gerarFrase('x'.repeat(200), 'familias', 0).length).toBeLessThanOrEqual(120);
    expect(gerarFrase('', 'mulheres', 0, 'Menopausa')).toMatch(/menopausa/);
  });
  it('o resumo lista o padrão, a impressão e os campos preenchidos', () => {
    const r = pedido({ familia: 'convite', conta: 'evento', publico: 'mulheres', uso: 'impressa', copias: 2, plastificar: 'nao', dados: { t2: 'Menopausa', hora: '14h' } });
    const s = resumoDoPedido(r, 'Unidade DIC', fichaDeImpressao('convite', r));
    expect(s).toContain('Padrão: Convite de evento'); expect(s).toContain('2 cópias'); expect(s).toContain('Título · palavra grande: Menopausa'); expect(s).not.toContain('Foto');
  });
});
