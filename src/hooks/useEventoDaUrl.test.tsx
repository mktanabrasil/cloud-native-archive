import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { AppEvent } from '@/types';

/** O botão do e-mail de devolução: `?evento=` abre o evento (13/11/2026). */
const erro = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => erro(...a) } }));
const { useEventoDaUrl } = await import('./useEventoDaUrl');

const evento = { id: 'e1', title: 'Festa da Primavera' } as AppEvent;
const montar = (eventos: AppEvent[], carregando: boolean, abrir: (e: AppEvent) => void) => {
  const local = { search: '' };
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/?tela=visao-geral&evento=e1']}>{children}</MemoryRouter>;
  const r = renderHook(({ ev, car }) => { useEventoDaUrl(ev, car, abrir); local.search = useLocation().search; }, { wrapper, initialProps: { ev: eventos, car: carregando } });
  return { ...r, local };
};

beforeEach(() => erro.mockClear());

describe('o evento pedido na URL', () => {
  it('espera a lista chegar, abre o evento e tira o parâmetro', () => {
    const abrir = vi.fn();
    const { rerender, local } = montar([], true, abrir);
    expect(abrir).not.toHaveBeenCalled();
    rerender({ ev: [evento], car: false });
    expect(abrir).toHaveBeenCalledWith(evento);
    expect(local.search).toBe('?tela=visao-geral');
  });

  it('não achou (apagado, ou de outra unidade): avisa e tira o parâmetro', () => {
    const abrir = vi.fn();
    const { local } = montar([{ ...evento, id: 'outro' }], false, abrir);
    expect(abrir).not.toHaveBeenCalled();
    expect(erro).toHaveBeenCalledWith('Não encontrei este evento', expect.anything());
    expect(local.search).toBe('?tela=visao-geral');
  });
});
