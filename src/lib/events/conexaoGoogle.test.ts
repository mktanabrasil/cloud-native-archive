import { describe, expect, it } from 'vitest';
import { retornoDoGoogle, situacaoDaConexao, textoDaTroca } from './conexaoGoogle';

const conexao = { google_email: 'eventos@anabrasil.org', calendar_id: 'abc@group.calendar.google.com', calendar_nome: 'Eventos ANA Brasil', conectado_por: 'mkt@anabrasil.org', conectado_em: '2026-09-16T11:10:00Z', erro: null };

describe('situacaoDaConexao', () => {
  it('sem conexão: conectar; conectado sem agenda: escolher; erro: perdida; tudo certo: conectado', () => {
    expect(situacaoDaConexao({ conexao: null })).toBe('nao_conectado');
    expect(situacaoDaConexao({ conexao: { ...conexao, calendar_id: null, calendar_nome: null } })).toBe('sem_agenda');
    expect(situacaoDaConexao({ conexao: { ...conexao, erro: 'o Google desconectou a conta' } })).toBe('perdida');
    expect(situacaoDaConexao({ conexao })).toBe('conectado');
  });
});

describe('retornoDoGoogle', () => {
  it('só aceita o state nosso', () => {
    expect(retornoDoGoogle('?code=4/abc&state=agenda:u1:123')).toEqual({ code: '4/abc', state: 'agenda:u1:123' });
    expect(retornoDoGoogle('?code=4/abc&state=outro')).toBeNull();
    expect(retornoDoGoogle('?tela=calendario')).toBeNull();
  });
});

describe('textoDaTroca', () => {
  it('concorda em número e não fala de agenda antiga quando não há nada nela', () => {
    expect(textoDaTroca(0, 'Eventos ANA Brasil')).toBe('Os próximos eventos confirmados entram em "Eventos ANA Brasil".');
    expect(textoDaTroca(1, 'X')).toContain('1 evento sai');
    expect(textoDaTroca(3, 'X')).toContain('3 eventos saem');
  });
});
