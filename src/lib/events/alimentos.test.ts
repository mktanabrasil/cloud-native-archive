import { describe, expect, it } from 'vitest';
import type { Alimento, ItemComDetalhe } from '@/types';
import { comAlimentos, comCardapio, limparAlimentos, linhasDaRefeicao, paraProvidenciar, resumoDaRefeicao, textoDoFornecedor } from './alimentos';
import { OPCOES_COMIDA, OUTRO, limparItens, linhasParaCopiar, sincronizarItens } from './itens';

const arroz: Alimento = { nome: 'Arroz e feijão', quantidade: '120 porções', fornecedor: 'ANA' };
const frango: Alimento = { nome: 'Frango assado', quantidade: '25 kg', fornecedor: 'Parceiro', quem: 'Padaria Sol' };
const suco: Alimento = { nome: 'Suco', quantidade: '40 L', fornecedor: 'Unidade' };
const almoco: ItemComDetalhe = { item: 'Almoço', detalhes: '', alimentos: [arroz, frango, suco], cardapio: 'Arroz, feijão e frango. 12h30.' };

describe('quem fornece', () => {
  it('ANA é "providenciar"; os outros levam o nome junto', () => {
    expect(textoDoFornecedor(arroz)).toBe('ANA');
    expect(textoDoFornecedor(frango)).toBe('Parceiro · Padaria Sol');
    expect(textoDoFornecedor(suco)).toBe('Unidade');
  });

  it('o resumo da refeição conta alimentos e o que é para providenciar', () => {
    expect(resumoDaRefeicao([arroz, frango, suco])).toBe('3 alimentos · 1 a providenciar');
    expect(resumoDaRefeicao([frango])).toBe('1 alimento');
    expect(resumoDaRefeicao([])).toBe('');
    expect(resumoDaRefeicao([{ nome: '  ', quantidade: '', fornecedor: 'ANA' }])).toBe('');
  });

  it('"Para providenciar" junta as refeições e ignora "Nenhum"', () => {
    const cafe: ItemComDetalhe = { item: 'Café', detalhes: '', outro: true, alimentos: [{ nome: 'Bolo', quantidade: '4', fornecedor: 'ANA' }] };
    const lista = paraProvidenciar([almoco, cafe, { item: 'Nenhum', detalhes: '' }]);
    expect(lista.map(p => `${p.refeicao}: ${p.alimento.nome}`)).toEqual(['Almoço: Arroz e feijão', 'Café: Bolo']);
  });
});

describe('limpar', () => {
  it('apara, tira linha sem nome, e o "quem" só fica para quem não é ANA', () => {
    const r = limparAlimentos([
      { nome: ' Arroz ', quantidade: ' 10 ', fornecedor: 'ANA', quem: 'sobrou' },
      { nome: '', quantidade: 'x', fornecedor: 'Unidade' },
      { nome: 'Pão', quantidade: '', fornecedor: 'Doação', quem: ' Família Silva ' },
    ]);
    expect(r).toEqual([
      { nome: 'Arroz', quantidade: '10', fornecedor: 'ANA' },
      { nome: 'Pão', quantidade: '', fornecedor: 'Doação', quem: 'Família Silva' },
    ]);
  });

  it('limparItens leva a tabela e o cardápio junto, e mantém a lista vazia como marca do modelo novo', () => {
    const r = limparItens([almoco, { item: 'Lanche', detalhes: '', alimentos: [] }, { item: 'Jantar', detalhes: 'texto antigo' }]);
    expect(r[0].alimentos).toHaveLength(3);
    expect(r[0].cardapio).toBe('Arroz, feijão e frango. 12h30.');
    expect(r[1]).toEqual({ item: 'Lanche', detalhes: '', alimentos: [] });
    expect(r[2]).toEqual({ item: 'Jantar', detalhes: 'texto antigo' });
  });
});

describe('sincronizar e editar', () => {
  it('desligar e religar outra refeição preserva a tabela da que ficou', () => {
    const r = sincronizarItens('Almoço, Jantar', [almoco, { item: 'Lanche', detalhes: '', alimentos: [suco] }], OPCOES_COMIDA);
    expect(r[0].alimentos).toEqual([arroz, frango, suco]);
    expect(r[0].cardapio).toBe(almoco.cardapio);
    expect(r[1]).toEqual({ item: 'Jantar', detalhes: '' });
  });

  it('a tabela do "Outro" sobrevive enquanto o nome muda', () => {
    const a = comAlimentos(sincronizarItens('Café', [], OPCOES_COMIDA), OUTRO, [suco]);
    const b = comCardapio(sincronizarItens('Café dos voluntários', a, OPCOES_COMIDA), OUTRO, '7h30');
    expect(b[0]).toEqual({ item: 'Café dos voluntários', detalhes: '', outro: true, alimentos: [suco], cardapio: '7h30' });
  });
});

describe('copiar', () => {
  it('uma refeição com tabela vira uma linha por alimento, mais o cardápio', () => {
    expect(linhasDaRefeicao(almoco)).toEqual([
      '• Almoço',
      '  – Arroz e feijão, 120 porções — providenciar (ANA)',
      '  – Frango assado, 25 kg — Parceiro · Padaria Sol',
      '  – Suco, 40 L — Unidade',
      '  Cardápio: Arroz, feijão e frango. 12h30.',
    ]);
  });

  it('a lista mistura refeição nova e antiga sem quebrar', () => {
    const t = linhasParaCopiar('Alimentação', [almoco, { item: 'Jantar', detalhes: 'pizza pra 30' }]);
    expect(t.split('\n')[0]).toBe('Alimentação:');
    expect(t).toContain('• Jantar — pizza pra 30');
    expect(t).toContain('  – Suco, 40 L — Unidade');
  });
});
