import { beforeEach, describe, expect, it, vi } from 'vitest';

const espiao = vi.hoisted(() => ({
  session: null as unknown,
  getUserError: null as unknown,
  signOuts: [] as unknown[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: espiao.session } }),
      getUser: () => Promise.resolve({ data: { user: espiao.getUserError ? null : { id: 'u1' } }, error: espiao.getUserError }),
      signOut: (opts: unknown) => { espiao.signOuts.push(opts); return Promise.resolve({ error: null }); },
    },
  },
}));

const { AVISO_DE_SESSAO_EXPIRADA, conferirSessao, consumirAvisoDeLogin, sessaoMorta, tratarNaoAutorizado } = await import('./sessao');

beforeEach(() => { espiao.session = { access_token: 'x' }; espiao.getUserError = null; espiao.signOuts = []; sessionStorage.clear(); });

describe('sessaoMorta', () => {
  it('reconhece os sinais do servidor de login e ignora o resto', () => {
    expect(sessaoMorta({ code: 'session_not_found', status: 403 })).toBe(true);
    expect(sessaoMorta({ message: 'Session from session_id claim in JWT does not exist' })).toBe(true);
    expect(sessaoMorta({ code: 'refresh_token_not_found' })).toBe(true);
    expect(sessaoMorta({ message: 'Failed to fetch' })).toBe(false); // rede
    expect(sessaoMorta(null)).toBe(false);
  });
});

describe('conferirSessao', () => {
  it('sessão viva: não mexe em nada', async () => {
    expect(await conferirSessao()).toBe(true);
    expect(espiao.signOuts).toEqual([]);
    expect(consumirAvisoDeLogin()).toBeNull();
  });

  it('sessão morta: sai só localmente e deixa o aviso para o login, uma vez', async () => {
    espiao.getUserError = { code: 'session_not_found', status: 403, message: 'Session from session_id claim in JWT does not exist' };
    expect(await conferirSessao()).toBe(false);
    expect(espiao.signOuts).toEqual([{ scope: 'local' }]);
    expect(consumirAvisoDeLogin()).toBe(AVISO_DE_SESSAO_EXPIRADA);
    expect(consumirAvisoDeLogin()).toBeNull();
  });

  it('erro de rede não derruba a sessão', async () => {
    espiao.getUserError = { message: 'Failed to fetch' };
    expect(await conferirSessao()).toBe(true);
    expect(espiao.signOuts).toEqual([]);
  });

  it('tratarNaoAutorizado devolve true quando a pessoa foi deslogada', async () => {
    espiao.getUserError = { code: 'session_not_found' };
    expect(await tratarNaoAutorizado()).toBe(true);
    espiao.getUserError = null;
    expect(await tratarNaoAutorizado()).toBe(false);
  });
});
