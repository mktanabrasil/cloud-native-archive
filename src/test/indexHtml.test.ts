import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O `index.html` é o que WhatsApp, Facebook e X leem ao montar o cartão do
 * link. Até 08/09/2026 ele trazia o texto do template Lovable, em inglês, com
 * uma captura do Lovable como imagem — e a página de eventos é a mais
 * compartilhada do app. Estes testes fixam que isso não volta.
 */
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('index.html', () => {
  it('declara o idioma certo', () => {
    expect(html).toMatch(/<html lang="pt-BR">/);
  });

  it('não traz nada do template Lovable', () => {
    // O comentário do arquivo pode contar a história; as tags, não.
    expect(html).not.toMatch(/@Lovable|content="Lovable"|lovable.app/);
    expect(html).not.toMatch(/Cloud Native Archive/);
  });

  it('o cartão do link aponta para a imagem da ANA e descreve a programação', () => {
    expect(html).toMatch(/property="og:image" content="https:\/\/app\.anabrasil\.org\/og-eventos\.jpg"/);
    expect(html).toMatch(/property="og:title" content="Programação de Eventos · ANA Brasil"/);
    expect(html).toMatch(/property="og:locale" content="pt_BR"/);
  });
});
