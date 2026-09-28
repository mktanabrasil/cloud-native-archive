import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mensagemDaFuncao } from './erroDaFuncao';

describe('mensagem da Edge Function (28/09/2026)', () => {
  it('lê o { error } do corpo da resposta de erro, em vez de "non-2xx"', async () => {
    const erro = { message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify({ error: 'Não foi possível excluir: há registros no banco ligados a esta conta.' }), { status: 500 }) };
    expect(await mensagemDaFuncao(erro, null, 'Falha.')).toMatch(/^Não foi possível excluir: há registros/);
  });

  it('usa o { error } que já veio em data, e o padrão quando não há corpo', async () => {
    expect(await mensagemDaFuncao(null, { error: 'Acesso negado.' }, 'Falha.')).toBe('Acesso negado.');
    expect(await mensagemDaFuncao({ context: new Response('<html>502</html>', { status: 502 }) }, null, 'Falha.')).toBe('Falha.');
    expect(await mensagemDaFuncao(new Error('rede'), null, 'Falha.')).toBe('Falha.');
  });
});

describe('a migração que destrava a exclusão', () => {
  const sql = readFileSync('supabase/migrations/20260928150000_excluir_usuario_sem_travar.sql', 'utf8');

  it('lê as chaves do banco e só troca as que aceitam vazio', () => {
    expect(sql).toMatch(/FROM pg_constraint con/);
    expect(sql).toMatch(/con\.confdeltype IN \('a', 'r'\)/);
    expect(sql).toMatch(/IF c\.obrigatoria THEN[\s\S]*?CONTINUE;/);
    expect(sql).toMatch(/ON DELETE SET NULL/);
    expect(sql).not.toMatch(/ON DELETE CASCADE/);
  });
});
