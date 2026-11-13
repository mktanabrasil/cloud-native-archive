import { describe, expect, it } from 'vitest';
import { SEMPRE_RECEBEM as DO_APP, destinatariosDoAviso, CAIXAS_FIXAS_EM_TEXTO } from './avisos';
import { SEMPRE_RECEBEM, configDaLeitura, destinatarios, reservar } from '../../../supabase/functions/eventos-aviso/fila';

/** A fila de avisos na função (13/11/2026): caixas fixas, configuração, destinatários e a reserva. */

const perfis = [
  { email: 'dic@ana.org', name: 'Gestão DIC', unit: 'DIC', is_active: true, permission_level: 'gestor_unidade' },
  { email: 'nilo@ana.org', name: 'Gestão Nilópolis', unit: 'Nilópolis', is_active: true, permission_level: 'gestor_unidade' },
  { email: 'santana@ana.org', name: 'Gestão Santana', unit: 'Santana', is_active: true, permission_level: 'gestor_unidade' },
  { email: 'sem-nivel@ana.org', name: 'Sem Nível', unit: 'DIC', is_active: true, permission_level: null },
  { email: 'leitora@ana.org', name: 'Leitora', unit: 'DIC', is_active: true, permission_level: 'usuario_padrao' },
  { email: 'teste@ana.org', name: 'Conta de Teste', unit: 'DIC', is_active: true, permission_level: 'gestor_unidade' },
];
const LANCADO = { pre_lancamento: false, extras: [], excluidos: [] };

describe('as caixas fixas', () => {
  it('as seis, iguais no app e na função', () => {
    expect([...DO_APP]).toEqual(SEMPRE_RECEBEM);
    expect(SEMPRE_RECEBEM).toContain('adm@anabrasil.org');
    expect(SEMPRE_RECEBEM).toContain('financeiro@anabrasil.org');
    expect(CAIXAS_FIXAS_EM_TEXTO).toBe('mkt@, contato@, parceiros@, eventos@, adm@ e financeiro@');
  });
});

describe('a configuração lida', () => {
  it('erro na leitura: nada sai (null), em vez de agir como lançado', () => {
    expect(configDaLeitura(null, { message: 'timeout' }, undefined)).toEqual({ config: null, origem: 'erro' });
  });
  it('a linha do Painel manda, com os e-mails em minúsculas', () => {
    const r = configDaLeitura({ value: { pre_lancamento: false, extras: ['X@Ana.org '], excluidos: ['Teste@ana.org'] } }, null, 'true');
    expect(r.origem).toBe('painel');
    expect(r.config).toMatchObject({ pre_lancamento: false, extras: ['x@ana.org'], excluidos: ['teste@ana.org'] });
  });
  it('sem linha: a variável; sem a variável, pré-lançamento', () => {
    expect(configDaLeitura(null, null, undefined).config?.pre_lancamento).toBe(true);
    expect(configDaLeitura(null, null, 'true').config?.pre_lancamento).toBe(true);
    expect(configDaLeitura(null, null, 'false').config?.pre_lancamento).toBe(false);
    expect(configDaLeitura({ value: { qualquer: 1 } }, null, undefined).config?.pre_lancamento).toBe(true);
  });
});

describe('quem recebe', () => {
  it('no pré-lançamento, só as caixas fixas', () => {
    expect(destinatarios({ unit: 'DIC', created_by: 'Gestão DIC' }, perfis, { ...LANCADO, pre_lancamento: true })).toEqual(SEMPRE_RECEBEM);
  });
  it('lançado: a gestão da unidade; sem nível e leitora, fora; excluída, fora; avulso, dentro', () => {
    const l = destinatarios({ unit: 'DIC', created_by: 'ninguém' }, perfis, { ...LANCADO, excluidos: ['teste@ana.org'], extras: ['avulso@ana.org'] });
    expect(l).toContain('dic@ana.org');
    expect(l).toContain('avulso@ana.org');
    expect(l).not.toContain('sem-nivel@ana.org');
    expect(l).not.toContain('leitora@ana.org');
    expect(l).not.toContain('teste@ana.org');
    expect(l).not.toContain('santana@ana.org');
  });
  it('o Grupo avisa as três gestões', () => {
    const l = destinatarios({ unit: 'Grupo ANA Brasil', created_by: null }, perfis, LANCADO);
    for (const e of ['dic@ana.org', 'nilo@ana.org', 'santana@ana.org']) expect(l).toContain(e);
  });
  it('lançado, sem avulsos nem excluídos, é a mesma lista do app', () => {
    for (const unit of ['DIC', 'Santana', 'Grupo ANA Brasil', 'Administração'] as const) {
      const ev = { unit, created_by: 'Sem Nível' };
      expect(destinatarios(ev, perfis, LANCADO).sort()).toEqual(destinatariosDoAviso(ev as never, perfis).sort());
    }
  });
});

describe('a reserva de um aviso', () => {
  /** Uma linha de verdade: o banco aplica um UPDATE de cada vez. */
  const banco = (tentativas: number) => {
    const linha = { id: 'a1', tentativas };
    let fila = Promise.resolve();
    const cliente = {
      from: () => ({
        update: (campos: { tentativas: number }) => ({
          eq: (_c: string, id: string) => ({
            eq: (_c2: string, lida: number) => ({
              select: () => {
                const r = fila.then(async () => {
                  await new Promise((ok) => setTimeout(ok, 1));
                  if (linha.id !== id || linha.tentativas !== lida) return { data: [], error: null };
                  linha.tentativas = campos.tentativas;
                  return { data: [{ id }], error: null };
                });
                fila = r.then(() => undefined);
                return r;
              },
            }),
          }),
        }),
      }),
    };
    return { cliente, linha };
  };

  it('duas chamadas que leram o mesmo pendente: só uma envia', async () => {
    const { cliente, linha } = banco(0);
    const lido = { id: 'a1', tentativas: 0 };
    const [a, b] = await Promise.all([reservar(cliente, lido), reservar(cliente, lido)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(linha.tentativas).toBe(1);
  });

  it('a que caiu no meio não trava: a próxima lê o número novo e reserva', async () => {
    const { cliente, linha } = banco(1);
    expect(await reservar(cliente, { id: 'a1', tentativas: 0 })).toBe(false); // leitura velha
    expect(await reservar(cliente, { id: 'a1', tentativas: 1 })).toBe(true);
    expect(linha.tentativas).toBe(2);
  });

  it('erro do banco: não envia', async () => {
    const cliente = { from: () => ({ update: () => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'x' } }) }) }) }) }) };
    expect(await reservar(cliente, { id: 'a1', tentativas: 0 })).toBe(false);
  });
});
