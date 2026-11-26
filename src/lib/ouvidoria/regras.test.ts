import { describe, expect, it } from 'vitest';
import {
  Limitador, assuntoDoEmail, esperaDepoisDaFalha, lerEnvio, montarEmail, protocolo, quandoEmBrasilia,
} from '../../../supabase/functions/ouvidoria/regras';

/** As regras da Ouvidoria do site (26/11/2026). */
describe('as regras da Ouvidoria', () => {
  it('anônima: descarta nome e e-mail mesmo se vierem; tipo desconhecido vira "mensagem"', () => {
    expect(lerEnvio({ tipo: 'denuncia', mensagem: '  Texto\r\ncom linha  ', identificado: false, nome: 'X', email: 'x@y.com' }))
      .toEqual({ ok: true, mensagem: { tipo: 'denuncia', mensagem: 'Texto\ncom linha', identificado: false, nome: null, email: null } });
    expect(lerEnvio({ tipo: 'xingamento', mensagem: 'oi', identificado: false })).toMatchObject({ ok: true, mensagem: { tipo: 'mensagem' } });
  });
  it('identificada: nome curto e e-mail minúsculo; "sim" conta como sim', () => {
    expect(lerEnvio({ tipo: 'elogio', mensagem: 'ok', identificado: 'sim', nome: '  Maria   da  Silva ', email: ' Maria@Exemplo.COM ' }))
      .toEqual({ ok: true, mensagem: { tipo: 'elogio', mensagem: 'ok', identificado: true, nome: 'Maria da Silva', email: 'maria@exemplo.com' } });
    expect(lerEnvio({ tipo: 'elogio', mensagem: 'ok', identificado: true, nome: 'a'.repeat(200) })).toMatchObject({ ok: true, mensagem: { nome: 'a'.repeat(80), email: null } });
  });
  it('recusa: vazia, longa, formato errado; e-mail que não confere não derruba a mensagem', () => {
    expect(lerEnvio({ mensagem: ' \n ', identificado: false })).toEqual({ ok: false, erro: 'A mensagem está vazia.' });
    expect(lerEnvio({ mensagem: 'x'.repeat(3001), identificado: false })).toMatchObject({ ok: false });
    expect(lerEnvio({ mensagem: 'oi', identificado: true, email: 'maria@gmail' })).toMatchObject({ ok: true, mensagem: { email: 'maria@gmail' } });
    expect(lerEnvio({ mensagem: 'oi', identificado: true, nome: 'a'.repeat(79) + '😀b' })).toMatchObject({ ok: true, mensagem: { nome: 'a'.repeat(79) + '😀' } });
    expect(lerEnvio(null)).toMatchObject({ ok: false });
    expect(lerEnvio([1])).toMatchObject({ ok: false });
  });
  it('campo-isca preenchido é robô', () => {
    expect(lerEnvio({ mensagem: 'compre', identificado: false, website: 'http://spam' })).toEqual({ ok: 'robo' });
    expect(lerEnvio({ mensagem: 'oi', identificado: false, website: '   ' })).toMatchObject({ ok: true });
  });
  it('protocolo, assunto e data de Brasília', () => {
    expect(protocolo(2026, 42)).toBe('OUV-2026-0042');
    expect(assuntoDoEmail('reclamacao', 'OUV-2026-0042')).toBe('[Ouvidoria] RECLAMAÇÃO · OUV-2026-0042');
    expect(quandoEmBrasilia('2026-11-26T12:14:00Z')).toBe('26/11/2026, 09:14');
  });
  it('e-mail: anônima sem nada de quem enviou; identificada responde para a pessoa; HTML escapado', () => {
    const a = montarEmail({ tipo: 'denuncia', mensagem: 'a <b>b</b>', identificado: false, nome: null, email: null }, 'OUV-2026-0001', '2026-11-26T12:14:00Z');
    expect(a.responderPara).toBeNull();
    expect(a.texto).toContain('Pediu anonimato');
    expect(a.html).toContain('a &lt;b&gt;b&lt;/b&gt;');
    expect(a.html).not.toContain('<b>b</b>');
    const b = montarEmail({ tipo: 'elogio', mensagem: 'ok', identificado: true, nome: 'Ana "A"', email: 'ana@x.com' }, 'OUV-2026-0002', '2026-11-26T12:14:00Z');
    expect(b.responderPara).toBe('ana@x.com');
    expect(b.texto).toContain('Nome: Ana "A"');
    expect(b.html).toContain('Ana &quot;A&quot;');
    const c = montarEmail({ tipo: 'elogio', mensagem: 'ok', identificado: true, nome: null, email: 'maria@gmail' }, 'OUV-2026-0003', '2026-11-26T12:14:00Z');
    expect(c.responderPara).toBeNull();
    expect(c.texto).toContain('E-mail informado (parece incompleto, confira antes de responder): maria@gmail');
    expect(protocolo(2026, 12345)).toBe('OUV-2026-12345');
  });
  it('espera depois da falha: 5, 10, 20 min… até 6 h', () => {
    expect([1, 2, 3, 10].map((n) => esperaDepoisDaFalha(n) / 60_000)).toEqual([5, 10, 20, 360]);
  });
  it('limite em memória: 5 por chave na janela; outra chave segue; a janela passa', () => {
    const l = new Limitador(5, 100, 1000);
    expect([1, 2, 3, 4, 5, 6].map(() => l.permitir('a', 0))).toEqual([true, true, true, true, true, false]);
    expect(l.permitir('b', 0)).toBe(true);
    expect(l.permitir('a', 1001)).toBe(true);
    const g = new Limitador(5, 2, 1000);
    expect([g.permitir('x', 0), g.permitir('y', 0), g.permitir('z', 0)]).toEqual([true, true, false]);
  });
});
