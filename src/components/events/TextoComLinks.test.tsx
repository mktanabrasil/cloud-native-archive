import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextoComLinks } from './TextoComLinks';

describe('TextoComLinks', () => {
  it('endereços com https e www viram links em nova aba; o resto fica texto', () => {
    render(<TextoComLinks texto={'Inscrições em https://forms.gle/abc e mapa em www.maps.app/x. Dúvidas pelo WhatsApp.'} />);

    const links = screen.getAllByRole('link');
    expect(links.map(l => l.textContent)).toEqual(['https://forms.gle/abc', 'www.maps.app/x']);
    expect(links[0]).toHaveAttribute('href', 'https://forms.gle/abc');
    expect(links[1]).toHaveAttribute('href', 'https://www.maps.app/x');
    for (const l of links) {
      expect(l).toHaveAttribute('target', '_blank');
      expect(l.getAttribute('rel')).toContain('noopener');
    }
    expect(screen.getByText(/dúvidas pelo whatsapp/i)).toBeInTheDocument();
  });

  it('a pontuação que fecha a frase fica fora do link', () => {
    render(<TextoComLinks texto={'Veja https://anabrasil.org/eventos, depois volte.'} />);

    expect(screen.getByRole('link')).toHaveTextContent('https://anabrasil.org/eventos');
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://anabrasil.org/eventos');
  });

  it('não adivinha domínio solto nem interpreta HTML', () => {
    const { container } = render(<TextoComLinks texto={'Site anabrasil.org e <img src=x onerror="alert(1)"> aqui'} />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('sem endereço, é só o texto', () => {
    render(<TextoComLinks texto={'Um dia inteiro de atividades.'} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Um dia inteiro de atividades.')).toBeInTheDocument();
  });
});
