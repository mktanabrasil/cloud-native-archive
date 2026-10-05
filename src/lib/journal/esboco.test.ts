import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colocarFotos, conferirEsboco, numeroDaFoto, unidadeDoEsboco, type Esboco } from './esboco';

const BASE: Esboco = {
  unidade: { nome: 'CEI Bem Querer Prof. Anísio Spínola' },
  mes: 'Setembro de 2026',
  fundo: 'off_white',
  formas: { elemento: 'elemento_01', cores: { superior_esquerdo: 'coral', inferior_direito: 'amarelo' } },
  limite: 6,
  fotos: [{ n: 1 }, { n: 2 }, { n: 3 }],
  paginas: [{ tipo: 'capa', pecas: [
    { kind: 'text', style: 'titulo_capa', align: 'center', span: 6, content: 'Pequenos investigadores' },
    { kind: 'image', span: 3, ratio: '16/9', height: 290, foto: 1, caption: '' },
    { kind: 'image', span: 3, ratio: '4/3', foto: 2, caption: 'Na horta' },
  ] }],
};

describe('esboço → páginas do Jornal', () => {
  it('converte unidade, mês, cantos e peças', () => {
    const c = conferirEsboco(BASE, new Set([1, 2, 3]));
    expect(c.erros).toEqual([]);
    expect(c.unidade?.id).toBe('cei-anisio-spinola');
    expect(c.mes).toBe('Setembro 2026');
    const [p] = c.paginas;
    expect(p.template).toBe('capa');
    expect(p.decorations).toEqual([
      { element: 'elemento_01', corner: 'superior_esquerdo', color: 'coral' },
      { element: 'elemento_01', corner: 'inferior_direito', color: 'amarelo' },
    ]);
    expect(p.blocks[0]).toMatchObject({ kind: 'text', style: 'titulo_capa', align: 'center', span: 6 });
    expect(p.blocks[1]).toMatchObject({ kind: 'image', url: '', span: 3, ratio: '16/9', height: 290, fit: 'cover' });
    expect(c.fotosUsadas).toEqual([1, 2]);
    expect(c.fotosDeFora).toEqual([3]);
    expect(c.avisos).toContain('Fica de fora a foto 3, como no esboço.');
  });

  it('trava com o motivo: unidade, foto ausente, função e tipo desconhecidos', () => {
    const ruim: Esboco = { ...BASE, unidade: { nome: 'CEI Anísio Teixeira' }, paginas: [{ tipo: 'agenda2', pecas: [
      { kind: 'text', style: 'manchete', content: 'x' },
      { kind: 'image', span: 6, foto: 9 },
    ] }] };
    const c = conferirEsboco(ruim, new Set([1]));
    const tudo = c.erros.join('\n');
    expect(tudo).toMatch(/Unidade “CEI Anísio Teixeira”/);
    expect(tudo).toMatch(/tipo de página “agenda2”/);
    expect(tudo).toMatch(/função de texto “manchete”/);
    expect(tudo).toMatch(/foto 9 não está na pasta \(fotos\/foto-09\.jpg\)/);
  });

  it('coloca cada foto no seu quadro; a que não subiu fica vazia', () => {
    const c = conferirEsboco(BASE, new Set([1, 2]));
    const prontas = colocarFotos(c.paginas, c.fotoDoBloco, new Map([[1, 'https://x/1.jpg']]));
    const imgs = prontas[0].blocks.filter((b) => b.kind === 'image');
    expect(imgs.map((b) => (b as { url: string }).url)).toEqual(['https://x/1.jpg', '']);
  });

  it('nomes de arquivo e de unidade', () => {
    expect(numeroDaFoto('foto-07.jpg')).toBe(7);
    expect(numeroDaFoto('conferencia-fotos.jpg')).toBeNull();
    expect(unidadeDoEsboco('cei bem querer prof. anisio spinola')?.short).toBe('Anísio');
  });
});

// O primeiro caso real, quando a pasta existe nesta máquina.
const PASTA = 'C:/Users/anabr/Downloads/Jornal - Esboço/2026-10 Anísio';
describe.runIf(existsSync(`${PASTA}/esboco.json`))('caso real: 2026-10 Anísio', () => {
  it('6 páginas, 26 fotos, 18/22/27 de fora, sem erro', () => {
    const esboco = JSON.parse(readFileSync(`${PASTA}/esboco.json`, 'utf8')) as Esboco;
    const naPasta = new Set(readdirSync(`${PASTA}/fotos`).map(numeroDaFoto).filter((n): n is number => n !== null));
    const c = conferirEsboco(esboco, naPasta);
    expect(c.erros).toEqual([]);
    expect(c.paginas).toHaveLength(6);
    expect(c.fotosUsadas).toHaveLength(26);
    expect(c.fotosDeFora).toEqual([18, 22, 27]);
    expect(c.paginas.map((p) => p.template)).toEqual(['capa', 'galeria', 'galeria', 'galeria', 'galeria', 'galeria']);
  });
});
