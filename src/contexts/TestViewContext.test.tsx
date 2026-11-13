import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * O "ver como" só para a lista (13/11/2026). Até aqui um `|| true` liberava
 * para qualquer conta logada, inclusive a de candidato, que bastava gravar a
 * persona no sessionStorage para ver as telas de admin.
 */
const estado = vi.hoisted(() => ({ user: null as unknown }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: estado.user }) }));

const { TestViewProvider, useTestView, TEST_PERSONAS } = await import('./TestViewContext');
const montar = () => renderHook(() => useTestView(), { wrapper: ({ children }: { children: ReactNode }) => <TestViewProvider>{children}</TestViewProvider> });

beforeEach(() => sessionStorage.clear());

describe('quem pode ver como outra pessoa', () => {
  it('a comunicação pode, e a persona guardada volta', () => {
    sessionStorage.setItem('test_persona_id', TEST_PERSONAS[0].id);
    estado.user = { id: 'u1', email: 'MKT@anabrasil.org' };
    const { result } = montar();
    expect(result.current.canUseTestMode).toBe(true);
    expect(result.current.activePersona?.id).toBe(TEST_PERSONAS[0].id);
  });

  it('outra conta logada não pode, e a persona gravada à mão é apagada', () => {
    sessionStorage.setItem('test_persona_id', TEST_PERSONAS[0].id);
    estado.user = { id: 'u2', email: 'qualquer@exemplo.com', user_metadata: { conta: 'candidato' } };
    const { result } = montar();
    expect(result.current.canUseTestMode).toBe(false);
    expect(result.current.activePersona).toBeNull();
    expect(sessionStorage.getItem('test_persona_id')).toBeNull();
  });

  it('sem sessão, não', () => {
    estado.user = null;
    expect(montar().result.current.canUseTestMode).toBe(false);
  });
});
