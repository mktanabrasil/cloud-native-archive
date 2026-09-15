import { describe, expect, it } from 'vitest';
import { SEMPRE_RECEBEM, destinatariosDoAviso, textoDeEnviado, tipoDoAviso } from './avisos';

const perfis = [
  { email: 'maria@ana.org', name: 'Maria Souza', unit: 'DIC', is_active: true, permission_level: 'gestor_unidade' },
  { email: 'joao@ana.org', name: 'João Lima', unit: 'DIC', is_active: true, permission_level: 'editor' },
  { email: 'leitora@ana.org', name: 'Leitora', unit: 'DIC', is_active: true, permission_level: 'usuario_padrao' },
  { email: 'antiga@ana.org', name: 'Antiga', unit: 'DIC', is_active: false, permission_level: 'gestor_unidade' },
  { email: 'santana@ana.org', name: 'Gestão Santana', unit: 'Santana', is_active: true, permission_level: 'gestor_unidade' },
  { email: 'MKT@anabrasil.org', name: 'MKT ANA', unit: 'Administração', is_active: true, permission_level: 'admin_geral' },
  { email: 'leo@ana.org', name: 'Leonardo Garbo Rodrigues', unit: 'Nilópolis', is_active: true, permission_level: 'criador' },
];

describe('destinatariosDoAviso (decisão de 14/09/2026)', () => {
  it('as quatro caixas da ANA sempre, a gestão da unidade do evento, e quem criou', () => {
    const lista = destinatariosDoAviso({ unit: 'DIC', created_by: 'Leonardo Garbo Rodrigues' }, perfis);

    for (const fixo of SEMPRE_RECEBEM) expect(lista).toContain(fixo);
    expect(lista).toContain('maria@ana.org');
    expect(lista).toContain('joao@ana.org');
    expect(lista).toContain('leo@ana.org'); // criou, embora seja de outra unidade
    expect(lista).not.toContain('santana@ana.org'); // outra unidade
    expect(lista).not.toContain('leitora@ana.org'); // leitora não gere nada
    expect(lista).not.toContain('antiga@ana.org'); // desativada
  });

  it('não repete quem acumula papéis; e-mails ficam em minúsculas', () => {
    const lista = destinatariosDoAviso({ unit: 'Santana', created_by: 'MKT ANA' }, perfis);
    expect(lista.filter(e => e === 'mkt@anabrasil.org')).toHaveLength(1);
    expect(lista).toContain('santana@ana.org');
  });

  it('a Administração como unidade do evento não puxa a equipe inteira: só as caixas fixas e quem criou', () => {
    const lista = destinatariosDoAviso({ unit: 'Administração', created_by: 'ninguém' }, perfis);
    expect(lista).toEqual([...SEMPRE_RECEBEM]);
  });
});

describe('tipoDoAviso (espelho do gatilho)', () => {
  const base = { status: 'pendente', deleted_at: null, start_datetime: '2026-10-10T18:00:00Z', end_datetime: '2026-10-10T20:00:00Z', location: 'Unidade DIC' } as const;

  it('confirmar avisa; nascer confirmado avisa; pendente não', () => {
    expect(tipoDoAviso(base, { ...base, status: 'confirmado' })).toBe('confirmado');
    expect(tipoDoAviso(null, { ...base, status: 'confirmado' })).toBe('confirmado');
    expect(tipoDoAviso(null, base)).toBeNull();
  });

  it('cancelar ou apagar um confirmado avisa; cancelar um pendente não', () => {
    const conf = { ...base, status: 'confirmado' as const };
    expect(tipoDoAviso(conf, { ...conf, status: 'cancelado' })).toBe('cancelado');
    expect(tipoDoAviso(conf, { ...conf, deleted_at: '2026-09-15T00:00:00Z' })).toBe('cancelado');
    expect(tipoDoAviso(base, { ...base, status: 'cancelado' })).toBeNull();
  });

  it('mudar data, horário ou local de um confirmado avisa; mudar descrição não', () => {
    const conf = { ...base, status: 'confirmado' as const };
    expect(tipoDoAviso(conf, { ...conf, start_datetime: '2026-10-17T18:00:00Z', end_datetime: '2026-10-17T20:00:00Z' })).toBe('alterado');
    expect(tipoDoAviso(conf, { ...conf, location: 'Quadra' })).toBe('alterado');
    expect(tipoDoAviso(conf, { ...conf })).toBeNull();
  });
});

describe('textoDeEnviado', () => {
  it('concorda em número', () => {
    expect(textoDeEnviado(1)).toBe('Aviso enviado a 1 endereço');
    expect(textoDeEnviado(7)).toBe('Aviso enviado a 7 endereços');
  });
});

describe('tipoDoAviso: "atualizado" (só agenda)', () => {
  const conf = { status: 'confirmado', deleted_at: null, start_datetime: '2026-10-10T18:00:00Z', end_datetime: '2026-10-10T20:00:00Z', location: 'Unidade DIC', title: 'Chá', description: 'a', visibility: 'publico', unit: 'DIC' } as const;

  it('mudar título, descrição, visibilidade ou unidade de um confirmado é "atualizado"', () => {
    expect(tipoDoAviso(conf, { ...conf, title: 'Chá da tarde' })).toBe('atualizado');
    expect(tipoDoAviso(conf, { ...conf, description: 'b' })).toBe('atualizado');
    expect(tipoDoAviso(conf, { ...conf, visibility: 'interno' })).toBe('atualizado');
  });

  it('data ou local ganham de conteúdo: continua "alterado"', () => {
    expect(tipoDoAviso(conf, { ...conf, title: 'x', location: 'Quadra' })).toBe('alterado');
  });

  it('mesmo conteúdo, nada', () => {
    expect(tipoDoAviso(conf, { ...conf })).toBeNull();
  });
});
