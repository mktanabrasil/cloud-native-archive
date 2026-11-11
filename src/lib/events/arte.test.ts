import { describe, expect, it } from 'vitest';
import type { MarketingItem } from '@/types';
import { PEDIDO_VAZIO, comPedidoDeArte, errosDoPedidoDeArte, itensAntigosDeArte, lerPedidoDeArte, limparPedidoDeArte, pilulasDoPedido, temArte } from './arte';

const antigo: MarketingItem = { type: 'demanda_grafica', item: 'Cartaz', description: 'A3, colorido' };
// `cartaz` é o A4 plastificado (11/11/2026; antes "Cartaz A4", o mesmo tipo).
const pedido = { whatsapp: true, story: true, cartaz: true, quantidade: 6, legenda: 'Vem comemorar!', conteudo: 'Título, data, endereço' };

describe('ler e gravar o pedido', () => {
  it('um item por escolha, com legenda e conteúdo em cada um; o cartaz leva a quantidade', () => {
    const itens = comPedidoDeArte([antigo], pedido);
    expect(itens).toEqual([
      antigo,
      { type: 'arte_whatsapp', item: 'Arte para o WhatsApp', description: '', legenda: 'Vem comemorar!', conteudo: 'Título, data, endereço' },
      { type: 'story_instagram', item: 'Story do Instagram', description: '', legenda: 'Vem comemorar!', conteudo: 'Título, data, endereço' },
      { type: 'cartaz_a4', item: 'A4 plastificado', description: '', legenda: 'Vem comemorar!', conteudo: 'Título, data, endereço', quantidade: 6 },
    ]);
    expect(lerPedidoDeArte(itens)).toEqual(pedido);
    expect(itensAntigosDeArte(itens)).toEqual([antigo]);
  });

  it('sem escolha, nenhum item de arte fica; o antigo e a cobertura continuam', () => {
    const cobertura: MarketingItem = { type: 'cobertura', item: 'Cobertura', description: '' };
    expect(comPedidoDeArte([cobertura, antigo, ...comPedidoDeArte([], pedido)], PEDIDO_VAZIO)).toEqual([cobertura, antigo]);
    expect(lerPedidoDeArte([antigo])).toEqual(PEDIDO_VAZIO);
    expect(temArte([antigo])).toBe(true);
    expect(temArte([cobertura])).toBe(false);
  });

  it('limpar apara e tira a quantidade inválida; só cartaz não guarda legenda obrigatória', () => {
    const itens = limparPedidoDeArte(comPedidoDeArte([], { whatsapp: false, story: false, cartaz: true, quantidade: 0, legenda: '  ', conteudo: ' Título ' }));
    expect(itens).toEqual([{ type: 'cartaz_a4', item: 'A4 plastificado', description: '', legenda: '', conteudo: 'Título', quantidade: undefined }]);
  });
});

describe('validação', () => {
  it('fechado, nada a dizer', () => {
    expect(errosDoPedidoDeArte(PEDIDO_VAZIO, false)).toBeUndefined();
  });
  it('aberto sem escolha, sem conteúdo, sem legenda no WhatsApp, sem quantidade no cartaz', () => {
    expect(errosDoPedidoDeArte(PEDIDO_VAZIO, true)).toMatch(/marque o que precisa: whatsapp, story do instagram, a4 plastificado/i);
    expect(errosDoPedidoDeArte({ ...pedido, conteudo: '' }, true)).toMatch(/o que precisa estar na arte/i);
    expect(errosDoPedidoDeArte({ ...pedido, legenda: '' }, true)).toMatch(/legenda/i);
    expect(errosDoPedidoDeArte({ ...pedido, quantidade: null }, true)).toMatch(/quantas cópias do a4 plastificado/i);
    expect(errosDoPedidoDeArte({ ...pedido, whatsapp: false, legenda: '' }, true)).toBeUndefined();
    expect(errosDoPedidoDeArte(pedido, true)).toBeUndefined();
  });
});

describe('pílulas', () => {
  it('"A4 plastificado · 6" quando tem quantidade', () => {
    expect(pilulasDoPedido(pedido)).toEqual(['Arte para o WhatsApp', 'Story do Instagram', 'A4 plastificado · 6']);
    expect(pilulasDoPedido({ ...pedido, quantidade: null, whatsapp: false, story: false })).toEqual(['A4 plastificado']);
  });
});

describe('legenda só com WhatsApp (varredura de 25/09/2026)', () => {
  it('desmarcou o WhatsApp: a legenda escrita antes não é gravada no cartaz', () => {
    const itens = limparPedidoDeArte(comPedidoDeArte([], { whatsapp: false, story: false, cartaz: true, quantidade: 4, legenda: 'Vem!', conteudo: 'Título' }));
    expect(itens).toEqual([{ type: 'cartaz_a4', item: 'A4 plastificado', description: '', legenda: '', conteudo: 'Título', quantidade: 4 }]);
  });
});

describe('rede social (11/11/2026)', () => {
  it('só o story: não pede legenda, grava um item de story e nenhum de cartaz', () => {
    const s = { ...PEDIDO_VAZIO, story: true, conteudo: 'Título e data', legenda: 'sobrou' };
    expect(errosDoPedidoDeArte(s, true)).toBeUndefined();
    expect(limparPedidoDeArte(comPedidoDeArte([], s))).toEqual([{ type: 'story_instagram', item: 'Story do Instagram', description: '', legenda: '', conteudo: 'Título e data' }]);
    expect(lerPedidoDeArte(comPedidoDeArte([], s))).toMatchObject({ story: true, whatsapp: false, cartaz: false });
  });
});

describe('Arte / impressa (11/11/2026)', () => {
  it('o pedido antigo de "Cartaz A4" é lido como A4 plastificado, com a quantidade', () => {
    const antigoCartaz: MarketingItem[] = [{ type: 'cartaz_a4', item: 'Cartaz A4', description: '', legenda: '', conteudo: 'Título', quantidade: 3 }];
    expect(lerPedidoDeArte(antigoCartaz)).toMatchObject({ cartaz: true, quantidade: 3 });
    expect(pilulasDoPedido(lerPedidoDeArte(antigoCartaz))).toEqual(['A4 plastificado · 3']);
  });

  it('rede social e A4 juntos: um item de cada', () => {
    const ambos = { ...PEDIDO_VAZIO, story: true, cartaz: true, quantidade: 2, conteudo: 'Título' };
    expect(errosDoPedidoDeArte(ambos, true)).toBeUndefined();
    expect(limparPedidoDeArte(comPedidoDeArte([], ambos)).map(i => i.type)).toEqual(['story_instagram', 'cartaz_a4']);
  });
});
