import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const { ROTAS_DO_CANDIDATO, ehCandidato, emailValido, mensagemDaConta, primeiroNome, problemaDaSenha } = await import('./conta');
const { ENDERECOS_RESERVADOS, slugLivre } = await import('./modelo');

describe('conta do candidato', () => {
  it('só a conta marcada como candidato é candidato', () => {
    expect(ehCandidato({ user_metadata: { conta: 'candidato' } })).toBe(true);
    expect(ehCandidato({ user_metadata: { name: 'Equipe' } })).toBe(false);
    expect(ehCandidato(null)).toBe(false);
  });

  it('e-mail e senha', () => {
    expect(emailValido('leo@exemplo.com.br')).toBe(true);
    expect(emailValido('leo@exemplo')).toBe(false);
    expect(problemaDaSenha('curta1')).toMatch(/8 caracteres/);
    expect(problemaDaSenha('somenteletras')).toMatch(/letras e números/);
    expect(problemaDaSenha('voos2026mais')).toBeNull();
  });

  it('erros do Supabase viram frases de gente', () => {
    expect(mensagemDaConta({ message: 'Invalid login credentials' })).toBe('E-mail ou senha não conferem.');
    expect(mensagemDaConta({ message: 'User already registered' })).toMatch(/^Já existe uma conta/);
    expect(mensagemDaConta({ message: 'For security purposes, you can only request this after 42 seconds' })).toMatch(/^Muitas tentativas/);
    expect(mensagemDaConta(new Error('Failed to fetch'))).toMatch(/internet/);
  });

  it('primeiro nome para o "Olá"', () => {
    expect(primeiroNome({ user_metadata: { name: '  Leonardo Garbo ' }, email: 'x@y.com' })).toBe('Leonardo');
    expect(primeiroNome({ user_metadata: {}, email: 'ana.silva@y.com' })).toBe('ana.silva');
  });
});

describe('endereços reservados', () => {
  it('são exatamente as telas do candidato, e nenhuma vaga pega um deles', () => {
    expect([...ENDERECOS_RESERVADOS].sort()).toEqual(Object.values(ROTAS_DO_CANDIDATO).map(r => r.replace('/vagas/', '')).sort());
    expect(slugLivre('Entrar', [])).toBe('entrar-2');
    expect(slugLivre('Minha Área', [])).toBe('minha-area-2');
  });
});

describe('a migração da conta do candidato', () => {
  const sql = readFileSync('supabase/migrations/20260928120000_candidatos.sql', 'utf8');

  it('enxerta o desvio na função instalada, sem reescrevê-la de memória', () => {
    expect(sql).toMatch(/pg_get_functiondef\('public\.handle_new_user\(\)'::regprocedure\)/);
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.handle_new_user/);
    expect(sql).toMatch(/IF position\('desvio_do_candidato' IN def\) > 0 THEN/);
  });

  it('o candidato vê e edita só a própria linha; o RH lê todas', () => {
    expect(sql).toMatch(/candidatos_select_proprio[\s\S]*?USING \(user_id = auth\.uid\(\)\)/);
    expect(sql).toMatch(/candidatos_select_rh[\s\S]*?is_rh_or_admin\(auth\.uid\(\)\)/);
    expect(sql).not.toMatch(/GRANT [^;]*candidatos TO anon/);
  });
});
