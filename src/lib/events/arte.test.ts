import { describe, expect, it } from 'vitest';
import type { MarketingItem } from '@/types';
import { PEDIDO_VAZIO, comPedidoDeArte, errosDoPedidoDeArte, itensAntigosDeArte, lerPedidoDeArte, limparPedidoDeArte, pilulasDoPedido, temArte } from './arte';

const antigo: MarketingItem = { type: 'demanda_grafica', item: 'Cartaz', description: 'A3, colorido' };
const pedido = { whatsapp: true, cartaz: true, quantidade: 6, legenda: 'Vem comemorar!', conteudo: 'Título, data, endereço' };

describe('ler e gravar o pedido', () => {
  it('um item por escolha, com legenda e conteúdo em cada um; o cartaz leva a quantidade', () => {
    const itens = comPedidoDeArte([antigo], pedido);
    expect(itens).toEqual([
      antigo,
      { type: 'arte_whatsapp', item: 'Arte para o WhatsApp', description: '', legenda: 'Vem comemorar!', conteudo: 'Título, data, endereço' },
      { type: 'cartaz_a4', item: 'Cartaz A4', description: '', legenda: 'Vem comemorar!', conteudo: 'Título, data, endereço', quantidade: 6 },
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
    const itens = limparPedidoDeArte(comPedidoDeArte([], { whatsapp: false, cartaz: true, quantidade: 0, legenda: '  ', conteudo: ' Título ' }));
    expect(itens).toEqual([{ type: 'cartaz_a4', item: 'Cartaz A4', description: '', legenda: '', conteudo: 'Título', quantidade: undefined }]);
  });
});

describe('validação', () => {
  it('fechado, nada a dizer', () => {
    expect(errosDoPedidoDeArte(PEDIDO_VAZIO, false)).toBeUndefined();
  });
  it('aberto sem escolha, sem conteúdo, sem legenda no WhatsApp, sem quantidade no cartaz', () => {
    expect(errosDoPedidoDeArte(PEDIDO_VAZIO, true)).toMatch(/marque o que precisa/i);
    expect(errosDoPedidoDeArte({ ...pedido, conteudo: '' }, true)).toMatch(/o que precisa estar na arte/i);
    expect(errosDoPedidoDeArte({ ...pedido, legenda: '' }, true)).toMatch(/legenda/i);
    expect(errosDoPedidoDeArte({ ...pedido, quantidade: null }, true)).toMatch(/quantos cartazes/i);
    expect(errosDoPedidoDeArte({ ...pedido, whatsapp: false, legenda: '' }, true)).toBeUndefined();
    expect(errosDoPedidoDeArte(pedido, true)).toBeUndefined();
  });
});

describe('pílulas', () => {
  it('"Cartaz A4 · 6" quando tem quantidade', () => {
    expect(pilulasDoPedido(pedido)).toEqual(['Arte para o WhatsApp', 'Cartaz A4 · 6']);
    expect(pilulasDoPedido({ ...pedido, quantidade: null, whatsapp: false })).toEqual(['Cartaz A4']);
  });
});

describe('legenda só com WhatsApp (varredura de 25/09/2026)', () => {
  it('desmarcou o WhatsApp: a legenda escrita antes não é gravada no cartaz', () => {
    const itens = limparPedidoDeArte(comPedidoDeArte([], { whatsapp: false, cartaz: true, quantidade: 4, legenda: 'Vem!', conteudo: 'Título' }));
    expect(itens).toEqual([{ type: 'cartaz_a4', item: 'Cartaz A4', description: '', legenda: '', conteudo: 'Título', quantidade: 4 }]);
  });
});
