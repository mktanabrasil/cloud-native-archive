import { describe, expect, it } from 'vitest';
import { NEWS_UNITS } from '@/lib/news/units';
import { UNIDADES_POR_AREA, areaDaUnidade, encerrado, mensagemDoErro, problemaDoArquivo, problemaDoEnvio, reais, resumoDosSabores, totalDePizzas, valor } from './modelo';
import { csvDasConfirmacoes, nomeDaPlanilha } from './planilha';
import type { Confirmacao } from './api';

const unidade = (id: string) => NEWS_UNITS.find((u) => u.id === id)!;

describe('Pizza da Alegria', () => {
  it('CEIs e GOE em Educação; as unidades ANA em Social', () => {
    expect(areaDaUnidade(unidade('goe'))).toBe('educacao');
    expect(areaDaUnidade(unidade('cei-anisio-spinola'))).toBe('educacao');
    expect(areaDaUnidade(unidade('ana-dic'))).toBe('social');
    const social = UNIDADES_POR_AREA.find((g) => g.area === 'social')!.unidades.map((u) => u.short);
    expect(social).toEqual(expect.arrayContaining(['DIC', 'Nilópolis', 'Santana', 'Piauí', 'Oziel']));
    expect(UNIDADES_POR_AREA.flatMap((g) => g.unidades).every((u) => u.active)).toBe(true);
  });

  it('total, resumo e prazo', () => {
    const q = { marguerita: 1, calabresa: 2, frango: 0 };
    expect(totalDePizzas(q)).toBe(3);
    expect(reais(valor(3)).replace(/\s/g, ' ')).toBe('R$ 150,00');
    expect(resumoDosSabores(q)).toBe('1 Marguerita · 2 Calabresa fatiada');
    expect(encerrado(new Date('2026-11-30T23:59:00-03:00'))).toBe(false);
    expect(encerrado(new Date('2026-12-01T00:00:00-03:00'))).toBe(true);
  });

  it('o que falta antes de enviar: comprovante obrigatório, menos no dinheiro', () => {
    const base = { nome: 'Maria Souza', unidade: 'ana-dic', quantidades: { lombo: 1 }, forma: 'pix' as const, comprovante: null };
    expect(problemaDoEnvio(base)).toMatch(/comprovante/);
    expect(problemaDoEnvio({ ...base, forma: 'dinheiro' })).toBeNull();
    expect(problemaDoEnvio({ ...base, comprovante: new File(['x'], 'c.jpg') })).toBeNull();
    expect(problemaDoEnvio({ ...base, quantidades: {} })).toMatch(/pelo menos uma pizza/);
    expect(problemaDoEnvio({ ...base, unidade: null })).toMatch(/unidade/);
    expect(problemaDoEnvio({ ...base, nome: 'Ma' })).toMatch(/nome/);
  });

  it('arquivo e mensagens de erro', () => {
    expect(problemaDoArquivo(new File(['x'], 'c.pdf', { type: 'application/pdf' }))).toBeNull();
    expect(problemaDoArquivo(new File(['x'], 'c.docx', { type: 'application/msword' }))).toMatch(/foto ou um PDF/);
    expect(problemaDoArquivo(new File([new Uint8Array(11 * 1024 * 1024)], 'c.jpg', { type: 'image/jpeg' }))).toMatch(/10 MB/);
    expect(mensagemDoErro(new Error('prazo_encerrado'))).toMatch(/30\/11/);
    expect(mensagemDoErro(new Error('comprovante_repetido'))).toMatch(/já foi enviado/);
  });

  it('planilha com uma coluna por sabor', () => {
    const c: Confirmacao = { id: '1', numero: 'PZ-0001', nome: 'Maria Souza', unidade_id: 'ana-dic', unidade_nome: 'ANA DIC', area: 'social', sabores: { lombo: 2 }, quantidade: 2, total: 100, forma: 'pix', comprovante_caminho: 'envios/a.jpg', comprovante_nome: 'a.jpg', retirada: false, created_at: '2026-10-07T17:00:00Z' };
    const linhas = csvDasConfirmacoes([c]).replace('\uFEFF', '').trim().split('\r\n');
    expect(linhas[0]).toBe('Número;Quando;Nome;Unidade;Área;Marguerita;Frango;Calabresa fatiada;Muçarela;Lombo;Napolitana;Pizzas;Valor (R$);Pagamento;Comprovante;Retirada');
    expect(linhas[1]).toMatch(/^PZ-0001;\d\d\/10\/2026 \d\d:\d\d;Maria Souza;ANA DIC;Social;0;0;0;0;2;0;2;100,00;Pix;sim;não$/);
    expect(nomeDaPlanilha('ana-dic', new Date(2026, 9, 7))).toBe('pizza-da-alegria-ana-dic-07-10-2026.csv');
  });
});
