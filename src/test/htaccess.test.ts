import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O `.htaccess` sai junto na build e é o que o servidor lê. Estes testes fixam
 * as regras que já causaram problema uma vez, para não voltarem em silêncio.
 */
const htaccess = readFileSync(resolve(process.cwd(), 'public/.htaccess'), 'utf8');

/** Só as diretivas: os comentários do arquivo explicam decisões e citam nomes. */
const diretivas = htaccess
  .split(/\r?\n/)
  .filter(linha => !linha.trim().startsWith('#'))
  .join('\n');

describe('public/.htaccess', () => {
  it('continua com o fallback de rotas do React', () => {
    expect(diretivas).toMatch(/RewriteRule \. \/index\.html \[L\]/);
  });

  it('arquivo inexistente em /assets/ é 404, e a regra vem antes do fallback', () => {
    const r404 = diretivas.indexOf('RewriteRule ^assets/ - [R=404,L]');
    const fallback = diretivas.indexOf('RewriteRule . /index.html [L]');
    expect(r404).toBeGreaterThan(-1);
    expect(r404).toBeLessThan(fallback);
  });

  it('o index.html e as páginas do cartão de enquete não ficam em cache', () => {
    expect(diretivas).toContain('<FilesMatch "^(index|enquete|enquete-resultado|mercado|transparencia|jornal|app)\\.html$">');
    expect(diretivas).toMatch(/<FilesMatch "[^"]*">\s*Header set Cache-Control "no-cache"/);
  });

  it('as enquetes vão para as páginas com o próprio cartão de link, antes do fallback (25/09/2026)', () => {
    const resultado = diretivas.indexOf('RewriteRule ^enquete/[^/]+/resultado/?$ /enquete-resultado.html [L]');
    const voto = diretivas.indexOf('RewriteRule ^enquete/ /enquete.html [L]');
    const fallback = diretivas.indexOf('RewriteRule . /index.html [L]');
    expect(resultado).toBeGreaterThan(-1);
    // O de acompanhamento vem antes: senão a regra geral de /enquete/ o pegaria.
    expect(resultado).toBeLessThan(voto);
    expect(voto).toBeLessThan(fallback);
  });

  it('traz os cabeçalhos básicos de segurança', () => {
    expect(diretivas).toMatch(/X-Content-Type-Options "nosniff"/);
    expect(diretivas).toMatch(/Referrer-Policy "strict-origin-when-cross-origin"/);
    expect(diretivas).toMatch(/Permissions-Policy "camera=\(\), microphone=\(\), geolocation=\(\)"/);
    expect(diretivas).toMatch(/Strict-Transport-Security "max-age=\d+"/);
  });

  it('não restringe quem embute a página, por decisão de 08/09/2026', () => {
    expect(diretivas).not.toMatch(/frame-ancestors|X-Frame-Options/);
  });
});
