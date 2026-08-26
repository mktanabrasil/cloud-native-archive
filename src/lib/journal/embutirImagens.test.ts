import { describe, expect, it, vi } from 'vitest';
import { diagnosticarContaminacao, embutirImagens } from './embutirImagens';

/**
 * Duas regras, e as duas vêm de erro medido no aparelho:
 *
 * 1. **Foto remota entra embutida em base64.** É a única forma que o
 *    html2canvas marca como anônima, e sem isso o Safari do iPhone contamina
 *    o canvas e derruba o PDF inteiro.
 * 2. **Data URI não é tocado.** Trocar o `src` de uma `<img>` no clone zera o
 *    `naturalWidth`, e o html2canvas não desenha o que não consegue medir.
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

  it('não toca em data URI: logo e formas continuam com o src original', async () => {
    const buscar = vi.fn();
    const fonte = 'data:image/svg+xml,%3Csvg%3E';

    const mapa = await embutirImagens(folhaCom([fonte]), { buscar });

    // Trocar o src de uma <img> no clone zera o naturalWidth, e o html2canvas
    // não desenha o que não consegue medir.
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
