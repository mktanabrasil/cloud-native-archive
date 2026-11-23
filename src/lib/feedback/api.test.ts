import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
const { avisarOMarketing } = await import('./api');

/** O e-mail ao marketing tenta de novo quando a função falha (revisão do PR 1, 23/11/2026). */
describe('avisarOMarketing', () => {
  beforeEach(() => invoke.mockReset());

  it('enviou de primeira', async () => {
    invoke.mockResolvedValue({ data: { enviado: true }, error: null });
    expect(await avisarOMarketing('f1', [0, 0])).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('feedback-aviso', { body: { feedback_id: 'f1' } });
  });

  it('falhou e tenta de novo até dar certo', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('502') }).mockResolvedValueOnce({ data: { enviado: true }, error: null });
    expect(await avisarOMarketing('f1', [0, 0])).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('desiste depois de três tentativas', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('502') });
    expect(await avisarOMarketing('f1', [0, 0])).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('"já avisado" conta como avisado e não repete', async () => {
    invoke.mockResolvedValue({ data: { enviado: false, motivo: 'já avisado' }, error: null });
    expect(await avisarOMarketing('f1', [0, 0])).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
