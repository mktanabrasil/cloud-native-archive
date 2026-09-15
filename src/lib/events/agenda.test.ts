import { describe, expect, it } from 'vitest';
import { contagemDaAgenda, leituraDaAgenda, textoDaCarga } from './agenda';

const conf = { status: 'confirmado', deleted_at: undefined, google_event_id: 'g1', google_event_link: 'https://calendar.google.com/x' } as const;
const aviso = (agenda_status: string, extra: Record<string, unknown> = {}) => ({ agenda_status, agenda_erro: null, agenda_em: '2026-09-15T14:22:00Z', agenda_link: null, criado_em: '2026-09-15T14:20:00Z', ...extra }) as never;

describe('leituraDaAgenda', () => {
  it('confirmado e no Google: sincronizado, com link', () => {
    const l = leituraDaAgenda(conf, aviso('enviado'));
    expect(l).toMatchObject({ estado: 'sincronizado', link: 'https://calendar.google.com/x', quando: '2026-09-15T14:22:00Z' });
  });

  it('aviso pendente ganha do que já está no Google: aguardando', () => {
    expect(leituraDaAgenda(conf, aviso('pendente'))?.estado).toBe('aguardando');
  });

  it('falhou traz o erro', () => {
    expect(leituraDaAgenda({ ...conf, google_event_id: undefined }, aviso('falhou', { agenda_erro: 'Google 403' }))).toMatchObject({ estado: 'falhou', erro: 'Google 403' });
  });

  it('cancelado que já esteve lá: removido; cancelado que nunca esteve: nada', () => {
    expect(leituraDaAgenda({ ...conf, status: 'cancelado', google_event_id: undefined }, aviso('enviado'))?.estado).toBe('removido');
    expect(leituraDaAgenda({ ...conf, status: 'cancelado', google_event_id: undefined }, aviso('ignorado'))).toBeNull();
    expect(leituraDaAgenda({ ...conf, status: 'cancelado', google_event_id: undefined }, null)).toBeNull();
  });

  it('pendente sem nada no Google e sem aviso: nada a mostrar', () => {
    expect(leituraDaAgenda({ status: 'pendente', deleted_at: undefined, google_event_id: undefined, google_event_link: undefined }, null)).toBeNull();
    expect(leituraDaAgenda({ ...conf, google_event_id: undefined }, aviso('ignorado'))).toBeNull();
  });
});

describe('textoDaCarga e contagemDaAgenda', () => {
  it('concorda em número', () => {
    expect(textoDaCarga(14)).toBe('Enviar os 14 confirmados que faltam');
    expect(textoDaCarga(1)).toBe('Enviar o 1 confirmado que falta');
    expect(textoDaCarga(0)).toBe('Todos os confirmados já estão na agenda');
  });

  it('conta só confirmados vivos', () => {
    const c = contagemDaAgenda([
      { status: 'confirmado', deleted_at: undefined, google_event_id: 'a' },
      { status: 'confirmado', deleted_at: undefined, google_event_id: undefined },
      { status: 'confirmado', deleted_at: '2026-09-01', google_event_id: undefined },
      { status: 'pendente', deleted_at: undefined, google_event_id: undefined },
    ], 1);
    expect(c).toEqual({ confirmados: 2, naAgenda: 1, faltam: 1, comErro: 1 });
  });
});
