import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MercadoSolidarioPublicPage from './MercadoSolidarioPublicPage';

// O avisador de altura do iframe observa o documento; o jsdom não tem ResizeObserver.
class ResizeObserverFalso { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverFalso;

/**
 * Teste de fumaça da página pública do Mercado Solidário (varredura de
 * 17/09/2026). Existe por causa do banner que sumiu sem ninguém ver: ele
 * apontava para um endereço da plataforma antiga. Aqui se garante que a
 * imagem vem do próprio servidor, que os títulos estão lá e que o caminho
 * para o WhatsApp é o combinado.
 */
describe('MercadoSolidarioPublicPage', () => {
  it('o banner vem de app.anabrasil.org, não de um endereço da plataforma antiga', () => {
    render(<MercadoSolidarioPublicPage />);
    const banner = screen.getByTestId('banner-do-mercado');
    expect(banner.getAttribute('src')).toBe('https://app.anabrasil.org/mercado-solidario-banner.jpg');
    const fonte = banner.parentElement?.querySelector('source');
    expect(fonte?.getAttribute('srcset')).toContain('https://app.anabrasil.org/mercado-solidario-banner.webp');
    expect(fonte?.getAttribute('srcset')).not.toContain('__l5e');
  });

  it('títulos, título da aba, tema claro e o caminho para o WhatsApp', () => {
    render(<MercadoSolidarioPublicPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/alimentos/i);
    expect(screen.getByRole('heading', { name: 'Nosso Propósito' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Como sua empresa pode ajudar?' })).toBeInTheDocument();
    expect(document.title).toBe('Mercado Solidário · ANA Brasil');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.dataset.temaForcado).toBe('light');

    expect(screen.getByRole('button', { name: /abrir no whatsapp com a mensagem/i })).toBeInTheDocument();
    expect(screen.getByText(/abrimos o WhatsApp com a mensagem pronta/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /\(19\) 99727-8118/ })).toHaveAttribute('href', 'https://wa.me/5519997278118');
  });
});
