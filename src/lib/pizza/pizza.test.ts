import { describe, expect, it } from 'vitest';
import { NEWS_UNITS } from '@/lib/news/units';
import { UNIDADES_POR_AREA, areaDaUnidade, dataEHora, encerrado, formaDoMercadoPago, mensagemDoErro, problemaDoArquivo, problemaDoEnvio, reais, resumoDosSabores, totalDePizzas, valor } from './modelo';

const unidade = (id: string) => NEWS_UNITS.find((u) => u.id === id)!;

describe('Pizza da Alegria', () => {
  it('a forma do pagamento online, como o Mercado Pago devolve', () => {
    expect(formaDoMercadoPago('bank_transfer', 'pix')).toBe('Pix');
    expect(formaDoMercadoPago('credit_card', 'visa')).toBe('Cartão de crédito Visa');
    expect(formaDoMercadoPago('credit_card', 'master')).toBe('Cartão de crédito Mastercard');
    expect(formaDoMercadoPago('debit_card', 'debelo')).toBe('Cartão de débito Elo');
    expect(formaDoMercadoPago('credit_card', 'nova')).toBe('Cartão de crédito');
    expect(formaDoMercadoPago('account_money', 'account_money')).toBe('Saldo no Mercado Pago');
    expect(formaDoMercadoPago(null, null)).toBe('Mercado Pago');
    expect(dataEHora('2026-11-10T17:32:00Z')).toBe('10/11/2026, 14:32');
    expect(dataEHora(null)).toBe('');
  });

  it('CEIs e GOE em Educação; as unidades ANA em Social', () => {
    expect(areaDaUnidade(unidade('goe'))).toBe('educacao');
    expect(areaDaUnidade(unidade('cei-anisio-spinola'))).toBe('educacao');
    expect(areaDaUnidade(unidade('ana-dic'))).toBe('social');
    const social = UNIDADES_POR_AREA.find((g) => g.area === 'social')!.unidades.map((u) => u.short);
    expect(social).toEqual(expect.arrayContaining(['DIC', 'Nilópolis', 'Santana', 'Escritório']));
    expect(social).not.toContain('Piauí');
    // A ANA Oziel saiu das campanhas em 21/10/2026.
    expect(social).not.toContain('Oziel');
    expect(UNIDADES_POR_AREA.flatMap((g) => g.unidades).every((u) => u.active)).toBe(true);
  });

  it('total, resumo e prazo', () => {
    const q = { marguerita: 1, calabresa: 2, frango: 0 };
    expect(totalDePizzas(q)).toBe(3);
    expect(reais(valor(3)).replace(/\s/g, ' ')).toBe('R$ 165,00');
    expect(resumoDosSabores(q)).toBe('1 Marguerita · 2 Calabresa fatiada');
    expect(encerrado(new Date('2026-12-05T23:59:00-03:00'))).toBe(false);
    expect(encerrado(new Date('2026-12-06T00:00:00-03:00'))).toBe(true);
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

  it('o WhatsApp: com DDD, 10 ou 11 dígitos, formatado enquanto digita', async () => {
    const { whatsappValido, whatsappFormatado, problemaDoEnvio } = await import('./modelo');
    expect(whatsappValido('(19) 99876-5432')).toBe(true);
    expect(whatsappValido('1932345678')).toBe(true);
    expect(whatsappValido('99876-5432')).toBe(false);
    expect(whatsappValido('(09) 99876-5432')).toBe(false);
    expect(whatsappFormatado('19998765432')).toBe('(19) 99876-5432');
    expect(whatsappFormatado('1932345678')).toBe('(19) 3234-5678');
    expect(whatsappFormatado('199')).toBe('(19) 9');
    const base = { nome: 'Maria Souza', unidade: 'ana-dic', quantidades: { lombo: 1 }, forma: 'mercado_pago' as const, comprovante: null };
    expect(problemaDoEnvio({ ...base, telefone: '' })).toMatch(/WhatsApp/);
    expect(problemaDoEnvio({ ...base, telefone: '(19) 99876-5432' })).toBeNull();
  });

  it('arquivo e mensagens de erro', () => {
    expect(problemaDoArquivo(new File(['x'], 'c.pdf', { type: 'application/pdf' }))).toBeNull();
    expect(problemaDoArquivo(new File(['x'], 'c.docx', { type: 'application/msword' }))).toMatch(/foto ou um PDF/);
    expect(problemaDoArquivo(new File([new Uint8Array(11 * 1024 * 1024)], 'c.jpg', { type: 'image/jpeg' }))).toMatch(/10 MB/);
    expect(mensagemDoErro(new Error('prazo_encerrado'))).toMatch(/05\/12/);
    expect(mensagemDoErro(new Error('comprovante_repetido'))).toMatch(/já foi enviado/);
  });
});
