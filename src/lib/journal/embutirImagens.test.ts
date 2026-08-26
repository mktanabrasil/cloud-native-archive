import { describe, expect, it, vi } from 'vitest';
import { diagnosticarContaminacao, embutirImagens, svgDataUri } from './embutirImagens';

/**
 * O que importa aqui é uma coisa só: nenhuma imagem da folha pode chegar ao
 * canvas fora de `data:image/*;base64,`. É a única forma que o html2canvas
 * marca como anônima, e é o que impede o `SecurityError` que derruba o PDF
 * inteiro no Safari do iPhone.
 */

const BASE64 = /^data:image\/[^;]+;base64,/;

const folhaCom = (fontes: string[]) => {
  const raiz = document.createElement('div');
  fontes.forEach((fonte) => {
    const img = document.createElement('img');
    img.src = fonte;
    raiz.appendChild(img);
  });
  return raiz;
};

const respostaCom = (blob: Blob) => ({ ok: true, blob: async () => blob }) as unknown as Response;

describe('embutirImagens', () => {
  it('converte SVG percent-encoded em base64 sem perder o desenho', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="36"><path fill="#484848" d="M0 0h9v9H0z"/></svg>';
    const fonte = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    const mapa = await embutirImagens(folhaCom([fonte]));

    const embutida = mapa.get(fonte)!;
    expect(embutida).toMatch(BASE64);
    expect(atob(embutida.split(',')[1])).toBe(svg);
  });

  it('baixa a foto remota e devolve base64', async () => {
    const buscar = vi.fn().mockResolvedValue(respostaCom(new Blob(['foto'], { type: 'image/jpeg' })));
    const fonte = 'https://exemplo.supabase.co/storage/v1/object/public/fotos/a.jpg';

    const mapa = await embutirImagens(folhaCom([fonte]), { buscar });

    expect(mapa.get(fonte)).toMatch(BASE64);
    // `cache: 'reload'` é o que ignora a resposta que o Safari guardou sem CORS.
    expect(buscar).toHaveBeenCalledWith(fonte, { mode: 'cors', cache: 'reload' });
  });

  it('deixa de fora a imagem que não baixa, em vez de derrubar a exportação', async () => {
    const buscar = vi.fn().mockRejectedValue(new Error('sem rede'));
    const fonte = 'https://exemplo.supabase.co/storage/v1/object/public/fotos/b.jpg';

    const mapa = await embutirImagens(folhaCom([fonte]), { buscar });

    expect(mapa.has(fonte)).toBe(false);
  });

  it('não mexe no que já está em base64', async () => {
    const buscar = vi.fn();
    const fonte = svgDataUri('<svg xmlns="http://www.w3.org/2000/svg"/>');

    const mapa = await embutirImagens(folhaCom([fonte]), { buscar });

    expect(mapa.size).toBe(0);
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe('diagnosticarContaminacao', () => {
  const MARCACAO = `
    <div data-journal-page>
      <img data-ana-forma="true" src="data:image/svg+xml,%3Csvg%3E" />
      <img data-ana-logo="true" src="data:image/svg+xml,%3Csvg%3E" />
      <div data-block-kind="image"><img src="https://exemplo.co/a.jpg" /></div>
      <p>texto</p>
    </div>`;

  /** Simula o aparelho: a folha só sai limpa quando o elemento sujo saiu. */
  const rasterizadorSujoEm = (seletorSujo: string) => async (recorte: (doc: Document) => void) => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = MARCACAO;
    recorte(doc);
    const aindaSujo = doc.querySelector(seletorSujo) !== null;
    return {
      width: 1,
      height: 1,
      toDataURL: () => {
        if (aindaSujo) throw new DOMException('The operation is insecure.', 'SecurityError');
        return 'data:image/png;base64,iVBORw0KGgo=';
      },
    } as unknown as HTMLCanvasElement;
  };

  it('nomeia a camada que contamina', async () => {
    expect(await diagnosticarContaminacao(rasterizadorSujoEm('[data-ana-forma]'))).toBe('limpa sem formas');
    expect(await diagnosticarContaminacao(rasterizadorSujoEm('[data-block-kind="image"] img'))).toBe(
      'limpa sem fotos',
    );
  });

  it('diz quando nem tirar toda imagem resolve — aí não é imagem', async () => {
    expect(await diagnosticarContaminacao(rasterizadorSujoEm('p'))).toBe('suja mesmo sem imagem alguma');
  });
});
