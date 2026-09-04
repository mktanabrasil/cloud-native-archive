import { describe, expect, it } from 'vitest';
import { linkPublicoDoEvento, prefixoDoLinkPublico, proximoSlug } from './linkPublico';

describe('linkPublicoDoEvento', () => {
  it('monta o endereço que a página pública realmente lê', () => {
    expect(linkPublicoDoEvento('hope-day', 'https://app.anabrasil.org')).toBe(
      'https://app.anabrasil.org/eventos?slug=hope-day',
    );
  });

  it('aceita o id quando não há slug, e escapa o que precisar', () => {
    expect(linkPublicoDoEvento('a b', 'https://x')).toBe('https://x/eventos?slug=a%20b');
  });

  it('o prefixo tira o protocolo para caber no campo', () => {
    expect(prefixoDoLinkPublico('https://app.anabrasil.org')).toBe('app.anabrasil.org/eventos?slug=');
  });
});

describe('proximoSlug', () => {
  it.each([
    ['hope-day', 'hope-day-2'],
    ['hope-day-2', 'hope-day-3'],
    ['hope-day-9', 'hope-day-10'],
    ['festa-2026', 'festa-2027'],
  ])('%s → %s', (de, para) => {
    expect(proximoSlug(de)).toBe(para);
  });
});
