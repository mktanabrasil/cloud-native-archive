import { describe, expect, it } from 'vitest';
import { descreverErroDeGravacao } from './mensagemDeErro';

const criar = { acao: 'criar' as const, unidade: 'Santana', slug: 'hope-day' };

describe('descreverErroDeGravacao', () => {
  it('RLS vira "sem permissão", com a unidade', () => {
    const r = descreverErroDeGravacao(
      { code: '42501', message: 'new row violates row-level security policy for table "events"' },
      criar,
    );
    expect(r.tipo).toBe('permissao');
    expect(r.titulo).toBe('Sem permissão para gravar em Santana');
  });

  it('slug duplicado é reconhecido pelo nome da constraint', () => {
    const r = descreverErroDeGravacao(
      { code: '23505', message: 'duplicate key value violates unique constraint "events_slug_key"' },
      criar,
    );
    expect(r.tipo).toBe('slug');
    expect(r.titulo).toContain('hope-day');
  });

  it('outra chave única não é confundida com slug', () => {
    const r = descreverErroDeGravacao(
      { code: '23505', message: 'duplicate key value violates unique constraint "events_external_id_key"' },
      criar,
    );
    expect(r.tipo).toBe('duplicado');
  });

  it('NOT NULL diz qual campo, com o nome da tela', () => {
    const r = descreverErroDeGravacao(
      { code: '23502', message: 'null value in column "location" of relation "events" violates not-null constraint' },
      criar,
    );
    expect(r.tipo).toBe('obrigatorio');
    expect(r.titulo).toBe('Falta preencher Localização');
  });

  it('rede caída não tem código, mas tem cara', () => {
    const r = descreverErroDeGravacao(new TypeError('Failed to fetch'), { acao: 'atualizar' });
    expect(r.tipo).toBe('rede');
    expect(r.titulo).toBe('Sem conexão');
    expect(r.descricao).toMatch(/salvar de novo/);
  });

  it('o resto continua genérico, mas com a mensagem do banco', () => {
    const r = descreverErroDeGravacao({ code: 'XX000', message: 'algo estranho' }, { acao: 'criar' });
    expect(r.tipo).toBe('desconhecido');
    expect(r.titulo).toBe('Não foi possível criar o evento');
    expect(r.descricao).toBe('algo estranho');
  });

  it('não quebra com erro vazio', () => {
    expect(descreverErroDeGravacao(undefined, { acao: 'criar' }).tipo).toBe('desconhecido');
  });
});
