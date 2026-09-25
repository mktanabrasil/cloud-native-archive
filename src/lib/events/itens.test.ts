import { describe, expect, it } from 'vitest';
import { OPCOES_COMIDA, OPCOES_EQUIP, OUTRO, comDetalhe, detalheDe, itensDeTexto, itensDoResumo, limparItens, linhasParaCopiar, paraTexto, pistaDoEstoque, sincronizarItens } from './itens';

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

describe('equipamentos (22/09/2026)', () => {
  it('Notebook saiu da lista; um evento antigo com Notebook cai em Outro, com o texto preservado', () => {
    expect(OPCOES_EQUIP).not.toContain('Notebook');
    const itens = sincronizarItens('Som, Notebook', [], OPCOES_EQUIP);
    expect(itens).toEqual([{ item: 'Som', detalhes: '' }, { item: 'Notebook', detalhes: '', outro: true }]);
  });

  it('a pista do estoque só existe para o que já foi contado', () => {
    expect(pistaDoEstoque('Projetor')).toBe('temos 1');
    expect(pistaDoEstoque('Som')).toBe('');
  });
});

describe('textos livres de evento antigo (varredura de 25/09/2026)', () => {
  it('um item antigo sem a marca "outro" mantém o detalhe', () => {
    const r = sincronizarItens('Som, Notebook', [{ item: 'Som', detalhes: '' }, { item: 'Notebook', detalhes: '2 da sala' }], OPCOES_EQUIP);
    expect(r).toEqual([{ item: 'Som', detalhes: '' }, { item: 'Notebook', detalhes: '2 da sala', outro: true }]);
  });

  it('dois textos livres viram um "Outro" só, com os dois nomes e os dois detalhes', () => {
    const r = sincronizarItens('Som, Notebook, Extensão', [
      { item: 'Notebook', detalhes: '2 da sala' },
      { item: 'Extensão', detalhes: '10 m' },
    ], OPCOES_EQUIP);
    expect(r[1]).toEqual({ item: 'Notebook, Extensão', detalhes: 'Notebook: 2 da sala · Extensão: 10 m', outro: true });
    // A string gravada continua a mesma
    expect(paraTexto(r)).toBe('Som, Notebook, Extensão');
  });

  it('depois de tocado, o "Outro" guarda o próprio detalhe pela chave de sempre', () => {
    const a = sincronizarItens('Som, Notebook, Extensão', [], OPCOES_EQUIP);
    const b = comDetalhe(a, OUTRO, 'da secretaria');
    expect(sincronizarItens('Som, Notebook, Extensão', b, OPCOES_EQUIP)[1].detalhes).toBe('da secretaria');
  });
});
