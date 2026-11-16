import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Setores (16/11/2026): as abas do Marketing viraram a faixa do setor; a
 * página mostra a aba que está no endereço.
 */
const papel = vi.hoisted(() => ({ isMarketing: true, loading: false }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => papel }));
vi.mock('@/pages/AuditPage', () => ({ default: () => <p>aba: auditoria</p> }));
vi.mock('@/pages/DesignManualPage', () => ({ default: () => <p>aba: manual</p> }));
vi.mock('@/pages/TransparencyPage', () => ({ default: () => <p>aba: transparência</p> }));
vi.mock('@/pages/AdminToolboxPage', () => ({ default: () => <p>aba: widgets</p> }));
vi.mock('@/pages/EnquetesPage', () => ({ default: () => <p>aba: enquetes</p> }));
vi.mock('@/components/pizza/PainelDaPizza', () => ({ PainelDaPizza: () => <p>aba: pizza</p> }));
vi.mock('@/components/voluntariado/PainelDoVoluntariado', () => ({ PainelDoVoluntariado: () => <p>aba: voluntariado</p> }));

const { default: MarketingHubPage } = await import('./MarketingHubPage');
const abrir = (url: string) => render(<MemoryRouter initialEntries={[url]}><MarketingHubPage /></MemoryRouter>);

describe('o Marketing pela URL', () => {
  it.each([
    ['/marketing?aba=pizza', 'aba: pizza'],
    ['/marketing?aba=voluntariado', 'aba: voluntariado'],
    ['/marketing', 'aba: auditoria'],
    ['/marketing?aba=nao-existe', 'aba: auditoria'],
  ])('%s abre %s, sem as abas antigas', (url, texto) => {
    abrir(url);
    expect(screen.getByText(texto)).toBeInTheDocument();
    expect(screen.getAllByText(/^aba:/)).toHaveLength(1);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('quem não é do marketing vê o acesso restrito', () => {
    papel.isMarketing = false;
    abrir('/marketing?aba=pizza');
    expect(screen.getByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
    papel.isMarketing = true;
  });
});
