import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

const reduz = vi.hoisted(() => ({ valor: false }));
vi.mock('@/hooks/useReduzMovimento', () => ({ useReduzMovimento: () => reduz.valor }));

const { FraseEmEscada, LinhaDePassos } = await import('./LinhaDeVoo');

/**
 * O pouso do login (28/09/2026): o quadrado verde só pode existir depois que
 * o avião chega na última parada. Onze mockups erraram isso de jeitos
 * diferentes; este teste segura o relógio e confere quadro a quadro.
 */

// O jsdom não mede SVG: uma linha reta de 1000 de comprimento, do (0,0) ao (1000,0).
const proto = SVGElement.prototype as unknown as Record<string, unknown>;
let quadros: Array<(t: number) => void> = [];
let agora = 0;

beforeEach(() => {
  vi.useFakeTimers();
  reduz.valor = false;
  proto.getTotalLength = () => 1000;
  proto.getPointAtLength = (l: number) => ({ x: l, y: 0 });
  proto.getComputedTextLength = () => 200;
  agora = 0;
  quadros = [];
  vi.spyOn(performance, 'now').mockImplementation(() => agora);
  vi.stubGlobal('requestAnimationFrame', (f: (t: number) => void) => { quadros.push(f); return quadros.length; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete proto.getTotalLength; delete proto.getPointAtLength; delete proto.getComputedTextLength;
});

/** Avança o relógio e roda os quadros pendentes, como o navegador faria. */
function avancar(ms: number) {
  act(() => {
    const fim = agora + ms;
    while (agora < fim) {
      agora = Math.min(fim, agora + 16);
      vi.advanceTimersByTime(16);
      const pendentes = quadros; quadros = [];
      pendentes.forEach(f => f(agora));
    }
  });
}

const acesas = () => document.querySelectorAll('circle[data-parada].vg-acende').length;
const pouso = () => screen.queryByTestId('pouso');

describe('o pouso do login', () => {
  it('nada de verde antes da chegada; o quadrado só nasce quando o avião chega', () => {
    render(<FraseEmEscada />);
    expect(pouso()).toBeNull();
    expect(screen.getByTestId('aviao')).toHaveAttribute('opacity', '0');

    avancar(700);   // decolou
    expect(pouso()).toBeNull();
    expect(screen.getByTestId('aviao')).toHaveAttribute('opacity', '1');

    avancar(1000);  // no meio do voo
    expect(pouso()).toBeNull();
    expect(acesas()).toBeGreaterThan(0);
    expect(acesas()).toBeLessThan(4);

    avancar(850);   // quase lá
    expect(pouso()).toBeNull();

    avancar(200);   // chegou
    expect(pouso()).not.toBeNull();
    expect(acesas()).toBe(4);
    expect(pouso()!.querySelector('rect')).toHaveAttribute('fill', '#81E2CF');
    expect(screen.getByTestId('aviao').querySelector('path')).toHaveAttribute('fill', '#F0EEE4');
  });

  it('o avião já voa claro, sem contorno, e é o último do desenho: passa por cima das letras', () => {
    const { container } = render(<FraseEmEscada />);
    avancar(1000);
    const aviao = screen.getByTestId('aviao');
    expect(aviao.querySelector('path')).toHaveAttribute('fill', '#F0EEE4');
    expect(aviao.querySelector('path')).not.toHaveAttribute('stroke');
    expect(container.querySelector('svg')!.lastElementChild).toBe(aviao);
  });

  it('as paradas acendem em ordem, conforme o avião passa', () => {
    render(<FraseEmEscada />);
    const vistas: number[] = [];
    for (let i = 0; i < 30; i++) { avancar(100); vistas.push(acesas()); }
    expect(vistas).toEqual([...vistas].sort((a, b) => a - b));
    expect(vistas.at(-1)).toBe(4);
  });

  it('quem pede menos movimento vê o logotipo pronto, sem voo', () => {
    reduz.valor = true;
    render(<FraseEmEscada />);
    expect(pouso()).not.toBeNull();
    expect(pouso()!.querySelector('.vg-onda')).toBeNull();
    expect(screen.getByTestId('aviao')).toHaveAttribute('opacity', '1');
  });
});

describe('o avião do cadastro (29/09/2026)', () => {
  it('voa escuro, só pousa na última parada depois de a conta ser criada, e clareia no pouso', () => {
    const { rerender } = render(<LinhaDePassos atual={2} />);
    avancar(700);
    expect(screen.getByTestId('aviao').querySelector('path')).toHaveAttribute('fill', 'hsl(var(--foreground))');
    expect(document.querySelector('image')).toBeNull();
    expect(pouso()).toBeNull();

    rerender(<LinhaDePassos atual={2} concluido />);
    avancar(700);
    expect(pouso()).not.toBeNull();
    expect(pouso()!.querySelector('rect')).toHaveAttribute('fill', '#81E2CF');
    expect(document.querySelector('circle[data-parada="2"]')).toHaveAttribute('fill', '#81E2CF');
    expect(screen.getByTestId('aviao').querySelector('path')).toHaveAttribute('fill', '#F0EEE4');
  });

  it('embaixo do avião a parada fica vazia; só ganha a cor depois que ele passa (06/10/2026)', () => {
    const { rerender } = render(<LinhaDePassos atual={0} />);
    avancar(100);
    const cor = (n: number) => document.querySelector(`circle[data-parada="${n}"]`)!.getAttribute('fill');
    expect(cor(0)).toBe('hsl(var(--background))');   // o avião está nela
    rerender(<LinhaDePassos atual={1} />);
    avancar(700);   // chegou na segunda
    expect(cor(0)).toBe('#F37964');                  // passou: coral
    expect(cor(1)).toBe('hsl(var(--background))');   // está nela: vazia
    rerender(<LinhaDePassos atual={1} concluido />);
    avancar(700);   // pousou na última
    expect(cor(1)).toBe('#FBCE00');
    expect(cor(2)).toBe('#81E2CF');
  });

  it('concluir antes da última parada: voa até ela, e o verde só nasce na chegada', () => {
    const { rerender } = render(<LinhaDePassos atual={0} />);
    rerender(<LinhaDePassos atual={0} concluido />);
    avancar(300);
    expect(pouso()).toBeNull();
    avancar(400);
    expect(pouso()).not.toBeNull();
  });
});
