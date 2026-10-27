import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UiV2 } from '@/lib/uiV2';

/**
 * Os embeds do site (Programação, Mercado Solidário, Portal da Transparência)
 * ficam fora do AppLayout e não ligam a V2: os componentes têm de sair
 * exatamente como antes do redesenho (pedido de 26/10/2026).
 */
describe('a V2 só vale dentro do app', () => {
  it('fora do app, cartão, botão e selo saem como antes', () => {
    render(<><Card data-testid="c" /><Button>Ok</Button><Badge>Confirmado</Badge></>);
    expect(screen.getByTestId('c')).toHaveClass('rounded-lg', 'shadow-sm');
    expect(screen.getByRole('button', { name: 'Ok' })).toHaveClass('rounded-md', 'font-medium');
    expect(screen.getByText('Confirmado')).toHaveClass('bg-primary');
  });

  it('dentro do app, o desenho novo', () => {
    render(<UiV2><Card data-testid="c" /><Button>Ok</Button><Badge>Confirmado</Badge></UiV2>);
    expect(screen.getByTestId('c')).toHaveClass('rounded-[20px]');
    expect(screen.getByTestId('c')).not.toHaveClass('shadow-sm');
    expect(screen.getByRole('button', { name: 'Ok' })).toHaveClass('rounded-xl');
    expect(screen.getByText('Confirmado')).not.toHaveClass('bg-primary');
  });
});
