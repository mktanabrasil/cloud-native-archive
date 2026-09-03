import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TituloDoEvento } from './TituloDoEvento';

/**
 * O título do evento chegava ao navegador como HTML cru, para que a pessoa
 * pudesse escrever `<br>`. O preço: qualquer marcação no campo virava HTML de
 * verdade — e a página pública é lida por visitante anônimo.
 */

describe('o que a pessoa escreve é texto', () => {
  it('não deixa a marcação virar elemento', () => {
    const { container } = render(
      <TituloDoEvento texto={'<img src=x onerror="alert(1)">Festa da Primavera'} />,
    );

    expect(container.querySelector('img')).toBeNull();
    // a marcação aparece como as letras que ela digitou, e não faz nada
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('não executa código nem quando o navegador tenta carregar a imagem', async () => {
    // A prova direta: o `onerror` de um `<img>` real dispara. Aqui não há img.
    const espiao = vi.fn();
    (window as unknown as { __disparou: () => void }).__disparou = espiao;

    const { container } = render(
      <TituloDoEvento texto={'<img src=x onerror="window.__disparou()">'} />,
    );
    // dá tempo de um onerror de verdade disparar, se existisse
    await new Promise((r) => setTimeout(r, 60));

    expect(container.querySelector('img')).toBeNull();
    expect(espiao).not.toHaveBeenCalled();
  });

  it('não deixa passar script', () => {
    const { container } = render(<TituloDoEvento texto={'<script>alert(1)</script>Bazar'} />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('Bazar');
  });
});

describe('a quebra de linha, que é o motivo de tudo isso', () => {
  it('vira quebra de verdade', () => {
    const { container } = render(<TituloDoEvento texto={'Festa<br>da Primavera'} />);

    expect(container.querySelectorAll('br')).toHaveLength(1);
    expect(container.textContent).toBe('Festada Primavera');
  });

  it('aceita as três formas de escrever', () => {
    const { container } = render(<TituloDoEvento texto={'a<br>b<BR/>c<br />d'} />);

    expect(container.querySelectorAll('br')).toHaveLength(3);
  });

  it('esconde a quebra no celular quando pedido', () => {
    const { container } = render(<TituloDoEvento texto={'Festa<br>da Primavera'} apenasNoDesktop />);

    const embrulho = container.querySelector('br')?.parentElement;
    expect(embrulho?.className).toContain('hidden');
    expect(embrulho?.className).toContain('md:inline');
  });

  it('sem marcador, é uma linha só', () => {
    render(<TituloDoEvento texto="Bazar Ana DIC" />);

    expect(screen.getByText('Bazar Ana DIC')).toBeInTheDocument();
  });
});
