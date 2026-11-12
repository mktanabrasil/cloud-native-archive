import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { CARTOES_DE_LINK, VERSAO_DA_ARTE, comCartao } from './cartoesDeLink';

// O index.html de verdade do projeto: se alguém mexer nas marcações dele, o
// teste avisa antes de o build gerar um cartão errado.
const index = readFileSync('index.html', 'utf8');
const voto = CARTOES_DE_LINK.find(c => c.arquivo === 'enquete.html')!;
const resultado = CARTOES_DE_LINK.find(c => c.arquivo === 'enquete-resultado.html')!;

const meta = (html: string, attr: string, nome: string) =>
  html.match(new RegExp(`<meta\\s+${attr}="${nome}"\\s+content="([^"]*)"`))?.[1];

describe('cartão de link das enquetes (25/09/2026)', () => {
  it('troca título, descrição e imagem, e tira o og:url da vitrine', () => {
    const html = comCartao(index, voto);
    expect(html).toContain('<title>Enquete · ANA Brasil</title>');
    expect(meta(html, 'property', 'og:title')).toBe('Enquete · ANA Brasil');
    expect(meta(html, 'property', 'og:description')).toMatch(/toque para votar/i);
    expect(meta(html, 'property', 'og:image')).toBe(`https://app.anabrasil.org/og-enquete.jpg?v=${VERSAO_DA_ARTE}`);
    expect(meta(html, 'name', 'twitter:image')).toBe(`https://app.anabrasil.org/og-enquete.jpg?v=${VERSAO_DA_ARTE}`);
    expect(meta(html, 'name', 'description')).toMatch(/toque para votar/i);
    expect(html).not.toMatch(/property="og:url"/);
    expect(html).not.toMatch(/Programação de Eventos/);
  });

  it('o de acompanhamento tem título e imagem próprios', () => {
    const html = comCartao(index, resultado);
    expect(meta(html, 'property', 'og:title')).toBe('Resultado da enquete · ANA Brasil');
    expect(meta(html, 'property', 'og:image')).toBe(`https://app.anabrasil.org/og-enquete-resultado.jpg?v=${VERSAO_DA_ARTE}`);
  });

  it('o resto do HTML (scripts, ícones, fonte) fica igual', () => {
    const html = comCartao(index, voto);
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html.length).toBeGreaterThan(index.length - 400);
  });

  it('se uma marcação sumir do index.html, falha alto em vez de gerar cartão errado', () => {
    const quebrado = index.replace(/<meta\s+property="og:image"[^>]*>/, '');
    expect(() => comCartao(quebrado, voto)).toThrow(/og:image/);
  });
});

describe('um cartão para cada página (25/09/2026)', () => {
  const htaccess = readFileSync('public/.htaccess', 'utf8');
  const fallback = htaccess.indexOf('RewriteRule . /index.html [L]');

  it('cada cartão tem a sua regra no .htaccess, antes do fallback, e a imagem existe', () => {
    for (const c of CARTOES_DE_LINK) {
      const i = htaccess.indexOf(c.regra);
      expect(i, c.arquivo).toBeGreaterThan(-1);
      expect(i, c.arquivo).toBeLessThan(fallback);
      expect(existsSync('public' + c.imagem), c.imagem).toBe(true);
    }
  });

  it('a foto do desfile saiu de todo lugar', () => {
    expect(existsSync('public/og-eventos.jpg')).toBe(false);
    for (const c of CARTOES_DE_LINK) expect(c.imagem).not.toMatch(/og-eventos/);
  });

  it('toda rota do app cai num cartão: o seu, ou o da programação (raiz e vitrine)', () => {
    const rotas = [...readFileSync('src/App.tsx', 'utf8').matchAll(/path="([^"]+)"/g)].map(m => m[1]);
    const regras = CARTOES_DE_LINK.map(c => new RegExp(c.regra.split(' ')[1]));
    const doIndex = ['/', '/eventos', '*', '/.lovable/oauth/consent'];
    for (const rota of rotas) {
      if (doIndex.includes(rota)) continue;
      const caminho = rota.replace(/^\//, '').replace(':slug', 'exemplo');
      expect(regras.some(r => r.test(caminho)), rota).toBe(true);
    }
  });
});

describe('a Central do Voluntário (13/11/2026)', () => {
  const central = CARTOES_DE_LINK.find(c => c.arquivo === 'voluntariado-central.html')!;
  const regra = (c: typeof central) => new RegExp(c.regra.split(' ')[1]);

  it('instala como "Central ANA", abrindo na própria Central', () => {
    const html = comCartao(index, central);
    expect(html).toContain('<link rel="manifest" href="/manifest-central.webmanifest" />');
    expect(meta(html, 'name', 'apple-mobile-web-app-title')).toBe('Central ANA');
    expect(meta(html, 'name', 'application-name')).toBe('Central ANA');
    expect(meta(html, 'property', 'og:title')).toBe('Central do Voluntário · Natal Feliz');
    const m = JSON.parse(readFileSync('public/manifest-central.webmanifest', 'utf8'));
    expect(m.start_url).toBe('/voluntariado/natalfeliz26/central');
    expect(m.short_name).toBe('Central ANA');
  });

  it('os outros cartões continuam com o manifest do app', () => {
    expect(comCartao(index, voto)).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });

  it('a Central e as abas no cartão dela; o formulário e a presença nos de sempre', () => {
    for (const c of ['voluntariado/natalfeliz26/central', 'voluntariado/natalfeliz26/central/credencial']) expect(regra(central).test(c), c).toBe(true);
    expect(regra(central).test('voluntariado/natalfeliz26')).toBe(false);
    const doApp = CARTOES_DE_LINK.find(c => c.arquivo === 'app.html')!;
    expect(regra(doApp).test('voluntariado/natalfeliz26/presenca')).toBe(true);
    expect(existsSync('public/sw-central.js') && existsSync('public/badge-central.png')).toBe(true);
  });
});

describe('versão da arte (25/09/2026)', () => {
  it('o index.html usa a mesma versão da arte que as cópias', () => {
    expect(index).toContain(`og-programacao.jpg?v=${VERSAO_DA_ARTE}`);
  });
});
