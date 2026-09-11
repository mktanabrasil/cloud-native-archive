import { describe, expect, it } from 'vitest';
import { executarEmLote, textoDoLote, FRASES_LIXEIRA, frasesDeStatus } from './lote';

describe('executarEmLote', () => {
  it('espera todos e separa o que gravou do que o banco recusou', async () => {
    const r = await executarEmLote(['a', 'b', 'c'], async id => {
      if (id === 'b') throw Object.assign(new Error('permission denied'), { code: '42501' });
    });
    expect(r).toEqual({ feitos: ['a', 'c'], recusados: ['b'] });
  });
});

describe('textoDoLote', () => {
  it('tudo certo: só o título, com número e concordância', () => {
    expect(textoDoLote({ feitos: ['a', 'b', 'c', 'd', 'e'], recusados: [] }, FRASES_LIXEIRA)).toEqual({
      titulo: '5 eventos movidos para a lixeira',
      tudoRecusado: false,
    });
    expect(textoDoLote({ feitos: ['a'], recusados: [] }, FRASES_LIXEIRA).titulo).toBe('1 evento movido para a lixeira');
  });

  it('parte recusada: o título conta o que gravou e a descrição explica o resto', () => {
    const t = textoDoLote({ feitos: ['a', 'b', 'c'], recusados: ['d', 'e'] }, frasesDeStatus('cancelado'));
    expect(t.titulo).toBe('3 eventos alterados para "cancelado"');
    expect(t.descricao).toMatch(/^2 eventos não puderam ser alterados: já estão confirmados/);
    expect(t.tudoRecusado).toBe(false);
  });

  it('nada gravou: é erro, e o título é a recusa', () => {
    const t = textoDoLote({ feitos: [], recusados: ['d'] }, FRASES_LIXEIRA);
    expect(t.titulo).toBe('1 evento não pôde ser movido');
    expect(t.tudoRecusado).toBe(true);
  });
});
