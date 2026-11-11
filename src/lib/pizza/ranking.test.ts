import { describe, expect, it } from 'vitest';
import { calcularRanking, diasQueFaltam, mensagemDoRanking } from './ranking';
import type { Confirmacao } from './api';

const C = (o: Partial<Confirmacao>): Confirmacao => ({
  id: Math.random().toString(36), numero: 'PZ-X', nome: 'Maria Souza', unidade_id: 'ana-dic', unidade_nome: 'ANA DIC', area: 'social',
  sabores: { frango: 1 }, quantidade: 1, total: 55, forma: 'mercado_pago', comprovante_caminho: null, comprovante_nome: null,
  retirada: false, telefone: null, created_at: '2026-11-10T12:00:00Z', ...o,
});

describe('ranking da Pizza', () => {
  it('soma por unidade e por pessoa (WhatsApp; sem ele, nome sem acento e unidade)', () => {
    const r = calcularRanking([
      C({ telefone: '19911110001', nome: 'Roberto Alves', unidade_id: 'nil', unidade_nome: 'ANA Jardim Nilópolis', quantidade: 2 }),
      C({ telefone: '19911110001', nome: 'roberto alves', unidade_id: 'nil', unidade_nome: 'ANA Jardim Nilópolis', quantidade: 3 }),
      C({ nome: 'João Lima', quantidade: 2 }),
      C({ nome: 'joao  lima', quantidade: 1 }),
      C({ nome: 'Ana', unidade_id: 'adm', unidade_nome: 'Escritório (ADM)', quantidade: 1 }),
    ]);
    expect(r.unidades.map((u) => `${u.nome}:${u.pizzas}`)).toEqual(['ANA Jardim Nilópolis:5', 'ANA DIC:3', 'Escritório (ADM):1']);
    expect(r.pessoas.map((p) => `${p.nome}:${p.pizzas}`)).toEqual(['Roberto Alves:5', 'João Lima:3', 'Ana:1']);
    expect([r.pizzas, r.pedidos]).toEqual([9, 5]);
  });

  it('no empate, fica à frente quem chegou primeiro ao número', () => {
    const r = calcularRanking([
      C({ nome: 'Bruna', unidade_id: 'b', unidade_nome: 'B', quantidade: 2, created_at: '2026-11-12T12:00:00Z' }),
      C({ nome: 'Ana', unidade_id: 'a', unidade_nome: 'A', quantidade: 1, created_at: '2026-11-10T12:00:00Z' }),
      C({ nome: 'Ana', unidade_id: 'a', unidade_nome: 'A', quantidade: 1, created_at: '2026-11-11T12:00:00Z' }),
    ]);
    expect(r.pessoas.map((p) => p.nome)).toEqual(['Ana', 'Bruna']);
    expect(r.unidades.map((u) => u.nome)).toEqual(['A', 'B']);
  });

  it('a mensagem: líder, pódio, propósito, brinde em 17/12 e o prazo do momento', () => {
    const r = calcularRanking([
      C({ unidade_id: 'a', unidade_nome: 'ANA DIC', quantidade: 5, telefone: '1', nome: 'Roberto Alves' }),
      C({ unidade_id: 'b', unidade_nome: 'Escritório (ADM)', quantidade: 3, telefone: '2', nome: 'Luciana' }),
    ]);
    const sexta = mensagemDoRanking(r, new Date('2026-11-13T18:00:00Z'));
    expect(sexta).toContain('parcial até 13/11');
    expect(sexta).toContain('🥇 *ANA DIC* lidera entre as unidades, com 5 pizzas!');
    expect(sexta).toContain('🥈 Escritório (ADM) · 3');
    expect(sexta).toContain('*Roberto Alves* (ANA DIC) está na frente');
    expect(sexta).toContain('Natal das crianças atendidas pela ANA Brasil');
    expect(sexta).toContain('Integração dos Funcionários, em 17/12');
    expect(sexta).toContain('Ainda dá tempo');
    expect(sexta).toContain('https://app.anabrasil.org/pizza-da-alegria?c=3');
    expect(mensagemDoRanking(r, new Date('2026-11-27T18:00:00Z'))).toContain('Ainda dá tempo: pedidos até *05/12*.');
    expect(mensagemDoRanking(r, new Date('2026-12-04T18:00:00Z'))).toContain('*Última semana!* Os pedidos fecham no sábado, *05/12*.');
    expect(mensagemDoRanking(r, new Date('2026-12-05T12:00:00Z'))).toContain('*Hoje é o último dia*');
    const fim = mensagemDoRanking(r, new Date('2026-12-07T12:00:00Z'));
    expect(fim).toContain('Os pedidos já foram encerrados');
    expect(fim).not.toContain('https://');
  });

  it('dias que faltam até 05/12', () => {
    expect(diasQueFaltam(new Date('2026-11-13T18:00:00Z'))).toBe(23);
    expect(diasQueFaltam(new Date('2026-12-05T23:00:00-03:00'))).toBe(1);
    expect(diasQueFaltam(new Date('2026-12-06T00:00:01-03:00'))).toBe(0);
  });
});
