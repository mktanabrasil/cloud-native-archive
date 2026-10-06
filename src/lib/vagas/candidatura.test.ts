import { describe, expect, it } from 'vitest';
import { PERFIL_VAZIO } from './perfil';
import { copiaDoPerfil, faltamResponder, mensagemDaCandidatura, respondida } from './candidatura';
import type { PerguntaDeVaga } from './modelo';

const pergunta = (id: string, obrigatoria: boolean): PerguntaDeVaga => ({ id, vaga_id: 'v', texto: id, tipo: 'texto_curto', opcoes: [], obrigatoria, ordem: 0, bloqueada: false });

describe('candidatura', () => {
  it('resposta preenchida e obrigatórias que faltam', () => {
    expect(respondida('  ')).toBe(false);
    expect(respondida(['a'])).toBe(true);
    expect(respondida([])).toBe(false);
    expect(faltamResponder([pergunta('a', true), pergunta('b', false), pergunta('c', true)], { a: 'ok' }).map((p) => p.id)).toEqual(['c']);
  });

  it('a cópia do perfil leva o e-mail e as experiências, sem os campos do arquivo', () => {
    const p = { ...PERFIL_VAZIO, nome: 'Leo', curriculo_caminho: 'u/x.pdf', perfil_concluido_em: '2026-10-06' };
    const c = copiaDoPerfil(p, [{ id: 'e', funcao: 'A', onde: 'B', inicio: '2023-01', fim: null, atual: true, descricao: '' }], 'leo@x.com');
    expect(c).toMatchObject({ nome: 'Leo', email: 'leo@x.com', experiencias: [{ funcao: 'A', onde: 'B', inicio: '2023-01', fim: null, atual: true, descricao: '' }] });
    expect(c).not.toHaveProperty('curriculo_caminho');
    expect(c).not.toHaveProperty('perfil_concluido_em');
    expect((c.experiencias as Array<Record<string, unknown>>)[0]).not.toHaveProperty('id');
  });

  it('mensagens dos erros do banco', () => {
    expect(mensagemDaCandidatura(new Error('duplicate key value violates unique constraint "candidaturas_uma_ativa_por_vaga"'))).toMatch(/já se candidatou/);
    expect(mensagemDaCandidatura(new Error('new row violates row-level security policy'))).toMatch(/não está mais recebendo/);
    expect(mensagemDaCandidatura(new Error('Failed to fetch'))).toMatch(/internet/);
  });
});
