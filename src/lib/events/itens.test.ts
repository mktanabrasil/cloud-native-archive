import { describe, expect, it } from 'vitest';
import { OPCOES_COMIDA, OUTRO, comDetalhe, detalheDe, itensDeTexto, itensDoResumo, limparItens, linhasParaCopiar, paraTexto, sincronizarItens } from './itens';

describe('sincronizarItens', () => {
  it('monta a lista a partir do valor e preserva detalhes já escritos', () => {
    const atuais = [{ item: 'Almoço', detalhes: '60 crianças, 12h' }, { item: 'Lanche', detalhes: 'bolo e suco' }];
    const r = sincronizarItens('Almoço, Jantar', atuais, OPCOES_COMIDA);
    expect(r).toEqual([{ item: 'Almoço', detalhes: '60 crianças, 12h' }, { item: 'Jantar', detalhes: '' }]);
  });

  it('o texto do “Outro” muda de nome a cada tecla, mas o detalhe fica', () => {
    const a = sincronizarItens('Almoço, Café', [], OPCOES_COMIDA);
    const b = comDetalhe(a, OUTRO, '7h30, 12 pessoas');
    const c = sincronizarItens('Almoço, Café dos voluntários', b, OPCOES_COMIDA);
    expect(c[1]).toEqual({ item: 'Café dos voluntários', detalhes: '7h30, 12 pessoas', outro: true });
  });

  it('“Nenhum” é resposta completa: a lista vira só ele, sem detalhe', () => {
    expect(sincronizarItens('Nenhum', [{ item: 'Almoço', detalhes: 'x' }], OPCOES_COMIDA)).toEqual([{ item: 'Nenhum', detalhes: '' }]);
  });

  it('vazio dá lista vazia', () => {
    expect(sincronizarItens('', [], OPCOES_COMIDA)).toEqual([]);
    expect(sincronizarItens(null, undefined, OPCOES_COMIDA)).toEqual([]);
  });
});

describe('detalheDe e comDetalhe', () => {
  it('lê e escreve pela chave', () => {
    const itens = [{ item: 'Almoço', detalhes: 'a' }, { item: 'Café', detalhes: 'b', outro: true }];
    expect(detalheDe(itens, 'Almoço')).toBe('a');
    expect(detalheDe(itens, OUTRO)).toBe('b');
    expect(detalheDe(itens, 'Lanche')).toBe('');
    expect(comDetalhe(itens, OUTRO, 'c')[1].detalhes).toBe('c');
  });
});

describe('limparItens e paraTexto', () => {
  it('apara, limita a 300 e tira item sem nome', () => {
    const r = limparItens([{ item: ' Almoço ', detalhes: ' x'.repeat(200) }, { item: '  ', detalhes: 'y' }, { item: 'Café', detalhes: ' z ', outro: true }]);
    expect(r[0].item).toBe('Almoço');
    expect(r[0].detalhes.length).toBe(300);
    expect(r).toHaveLength(2);
    expect(r[1]).toEqual({ item: 'Café', detalhes: 'z', outro: true });
    expect(paraTexto(r)).toBe('Almoço, Café');
  });
});

describe('itensDeTexto', () => {
  it('um evento antigo vira lista sem detalhes', () => {
    expect(itensDeTexto('Lanche, bolo de fubá', OPCOES_COMIDA)).toEqual([
      { item: 'Lanche', detalhes: '' },
      { item: 'bolo de fubá', detalhes: '', outro: true },
    ]);
  });
});

describe('resumo e cópia', () => {
  it('“Nenhum” não entra no resumo; a cópia diz “nenhum”', () => {
    expect(itensDoResumo([{ item: 'Nenhum', detalhes: '' }])).toEqual([]);
    expect(linhasParaCopiar('Alimentação', [{ item: 'Nenhum', detalhes: '' }])).toBe('Alimentação: nenhum');
  });

  it('um item por linha, com o detalhe depois do travessão', () => {
    const t = linhasParaCopiar('Alimentação', [
      { item: 'Almoço', detalhes: '60 crianças, 12h' },
      { item: 'Lanche', detalhes: '' },
    ]);
    expect(t).toBe('Alimentação:\n• Almoço — 60 crianças, 12h\n• Lanche');
  });
});
