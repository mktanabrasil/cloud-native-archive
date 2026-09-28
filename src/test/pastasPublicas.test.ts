import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Nenhuma pasta de public/ pode ter o nome de um endereço do app (28/09/2026).
 *
 * O .htaccess serve como está tudo o que existe de verdade no servidor, pasta
 * inclusive. Quando os ícones oficiais foram para public/vagas/, passou a
 * existir uma pasta /vagas no servidor: /vagas virou /vagas/ e deu 403, e a
 * vitrine inteira caiu. Este teste falha antes de isso ir ao ar de novo.
 */
describe('pastas de public/ e endereços do app', () => {
  it('nenhuma pasta tem o nome do primeiro trecho de uma rota', () => {
    const pastas = readdirSync('public').filter(n => statSync(join('public', n)).isDirectory());
    const app = readFileSync('src/App.tsx', 'utf8');
    const rotas = [...app.matchAll(/path="\/([^"/:?*]+)/g)].map(m => m[1]);
    // As rotas do candidato vêm de constantes (ROTAS_DO_CANDIDATO), todas em /vagas/...
    rotas.push('vagas');
    const colisoes = pastas.filter(p => rotas.includes(p));
    expect(colisoes, 'mude o nome da pasta em public/: o servidor a serviria no lugar da página').toEqual([]);
    expect(rotas).toContain('eventos');
  });
});
