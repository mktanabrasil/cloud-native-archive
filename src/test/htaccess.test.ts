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

  it('o index.html não fica em cache', () => {
    expect(diretivas).toMatch(/<Files "index\.html">\s*Header set Cache-Control "no-cache"/);
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
