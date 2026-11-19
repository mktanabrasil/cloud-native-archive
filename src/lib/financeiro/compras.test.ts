import { describe, expect, it } from 'vitest';
import { itensDoEvento, lerValor, marcasSoltas, listaDoMes, numerosDoMes, textoDoEvento, textoDoMes, type EventoDoFinanceiro } from './compras';

/** Financeiro: compras e cotações dos eventos (19/11/2026). */
const ev = (o: Partial<EventoDoFinanceiro>): EventoDoFinanceiro => ({
  id: 'e', title: 'Evento', unit: 'DIC', location: null, start_datetime: '2026-12-08T11:00:00Z', end_datetime: null, status: 'confirmado',
  food_items: [], transport_passengers: null, transport_external_support: false, transport_extra_equipment: false,
  transport_vehicle: null, transport_support_vehicle: null, itens: [], ...o,
});
const natal = ev({
  id: 'n', title: 'Natal Feliz', unit: 'Grupo ANA Brasil',
  food_items: [
    { item: 'Almoço', cardapio: 'Marmita na quadra', alimentos: [{ nome: 'Marmitex', quantidade: '450', fornecedor: 'ANA' }, { nome: 'Salada', quantidade: '20 kg', fornecedor: 'Doação', quem: 'Hortifruti' }] },
    { item: 'Lanche', alimentos: [{ nome: 'Suco de caixinha', quantidade: '500', fornecedor: 'ANA' }, { nome: 'Bolo', quantidade: '10', fornecedor: 'Parceiro' }] },
    { item: 'Café', detalhes: 'texto antigo' } as never,
  ],
  transport_external_support: true, transport_passengers: 120, transport_extra_equipment: true, transport_support_vehicle: 'utilitario',
});

describe('os itens do Financeiro', () => {
  it('só a comida que a ANA fornece e o transporte de fora', () => {
    expect(itensDoEvento(natal).map(i => `${i.grupo}: ${i.nome} · ${i.quantidade}`)).toEqual([
      'Almoço: Marmitex · 450', 'Lanche: Suco de caixinha · 500', 'Transporte de fora: Ônibus ou van fretados · 120 passageiros', 'Transporte de fora: Veículo de apoio · ',
    ]);
    expect(itensDoEvento(natal)[0].detalhe).toBe('Marmita na quadra');
  });
  it('sem marca, tudo a cotar; a marca vale enquanto o pedido não muda', () => {
    expect(itensDoEvento(natal).every(i => i.situacao === 'a_cotar')).toBe(true);
    const marcado = { ...natal, itens: [{ chave: 'alimento:almoco:marmitex', situacao: 'cotado' as const, valor: 4500, fornecedor: 'Marmitaria X', assinatura: 'Marmitex|450', atualizado_em: null, atualizado_por_nome: 'Financeiro' }] };
    expect(itensDoEvento(marcado)[0]).toMatchObject({ situacao: 'cotado', valor: 4500, fornecedor: 'Marmitaria X', mudou: false });
    const mudou = { ...marcado, food_items: [{ item: 'Almoço', alimentos: [{ nome: 'Marmitex', quantidade: '500', fornecedor: 'ANA' }] }] };
    expect(itensDoEvento(mudou)[0].mudou).toBe(true);
  });
  it('marca de item renomeado ou tirado não some em silêncio', () => {
    const e = { ...natal, itens: [{ chave: 'alimento:almoco:marmita', situacao: 'cotado' as const, valor: 10, fornecedor: null, assinatura: 'Marmita|450', atualizado_em: null, atualizado_por_nome: null },
      { chave: 'alimento:almoco:marmitex', situacao: 'cotado' as const, valor: 10, fornecedor: null, assinatura: 'Marmitex|450', atualizado_em: null, atualizado_por_nome: null }] };
    expect(marcasSoltas(e).map(m => m.nome)).toEqual(['Marmita']);
  });
  it('dois alimentos com o mesmo nome na mesma refeição não se confundem', () => {
    const e = ev({ food_items: [{ item: 'Almoço', alimentos: [{ nome: 'Água', quantidade: '100', fornecedor: 'ANA' }, { nome: 'Água', quantidade: '50', fornecedor: 'ANA' }] }] });
    expect(new Set(itensDoEvento(e).map(i => i.chave)).size).toBe(2);
  });
});

describe('o mês', () => {
  it('números (o que mudou volta a contar como a cotar) e total', () => {
    const e = { ...natal, itens: [
      { chave: 'alimento:almoco:marmitex', situacao: 'comprado' as const, valor: 4500, fornecedor: null, assinatura: 'Marmitex|450', atualizado_em: null, atualizado_por_nome: null },
      { chave: 'transporte:apoio-de-fora', situacao: 'cotado' as const, valor: 1200, fornecedor: 'Fretes', assinatura: '100', atualizado_em: null, atualizado_por_nome: null },
    ] };
    expect(numerosDoMes([e])).toEqual({ eventos: 1, aCotar: 3, cotados: 0, comprados: 1, total: 4500 });
  });
  it('a lista do mês vem por tipo e por data', () => {
    const outro = ev({ id: 'o', title: 'Karatê', start_datetime: '2026-12-02T12:00:00Z', food_items: [{ item: 'Lanche', alimentos: [{ nome: 'Suco', quantidade: '60', fornecedor: 'ANA' }] }] });
    expect(listaDoMes([natal, outro]).map(l => `${l.tipo}:${l.evento}:${l.nome}`)).toEqual([
      'alimentacao:Karatê:Suco', 'alimentacao:Natal Feliz:Marmitex', 'alimentacao:Natal Feliz:Suco de caixinha',
      'transporte:Natal Feliz:Ônibus ou van fretados', 'transporte:Natal Feliz:Veículo de apoio',
    ]);
  });
  it('copiar: o evento em texto e o mês em colunas para a planilha', () => {
    expect(textoDoEvento(natal).split('\n')[1]).toBe('- Almoço: Marmitex · 450 (A cotar)');
    expect(textoDoMes([natal]).split('\n')[0]).toBe('Tipo\tItem\tQuantidade\tEvento\tUnidade\tData\tSituação\tValor\tFornecedor');
  });
});

describe('lerValor', () => {
  it('aceita o jeito brasileiro e recusa o que não é número', () => {
    expect(lerValor('R$ 1.800,00')).toBe(1800);
    expect(lerValor('1800.5')).toBe(1800.5);
    expect(lerValor('45,9')).toBe(45.9);
    expect(lerValor('1.800')).toBe(1800);
    expect(lerValor('12.000')).toBe(12000);
    expect(lerValor('1.5')).toBe(1.5);
    expect(lerValor('')).toBeNull();
    expect(lerValor('caro')).toBeUndefined();
    expect(lerValor('-5')).toBeUndefined();
  });
});
