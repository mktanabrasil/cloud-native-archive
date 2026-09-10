import { describe, expect, it } from 'vitest';
import { textoDoWhatsApp } from './compartilhar';

const ev = (over: Partial<{ title: string; start_datetime: string; end_datetime: string; location: string }> = {}) => ({
  title: 'HOPE DAY<br>2026',
  start_datetime: new Date('2026-10-10T08:00').toISOString(),
  end_datetime: new Date('2026-10-10T16:00').toISOString(),
  location: 'Unidade Santana',
  ...over,
});

describe('textoDoWhatsApp', () => {
  it('título, data com horário, local e o link por último, um por linha', () => {
    expect(textoDoWhatsApp(ev(), 'https://app.anabrasil.org/eventos?slug=hope-day')).toBe(
      ['HOPE DAY 2026', '10 de outubro de 2026 · 08:00 às 16:00', 'Unidade Santana', 'https://app.anabrasil.org/eventos?slug=hope-day'].join('\n'),
    );
  });

  it('evento de vários dias usa o período e o começa/termina', () => {
    const texto = textoDoWhatsApp(ev({ end_datetime: new Date('2026-10-12T16:00').toISOString() }), 'https://x');
    expect(texto).toContain('10 a 12 de outubro de 2026 · Começa às 08:00, termina às 16:00');
  });

  it('sem local, a linha some em vez de ficar vazia', () => {
    const texto = textoDoWhatsApp(ev({ location: '  ' }), 'https://x');
    expect(texto.split('\n')).toHaveLength(3);
  });
});
