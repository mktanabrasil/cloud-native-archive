import { describe, expect, it } from 'vitest';
import type { AppEvent } from '@/types';
import { conflitam, conflitosDe, marcarConflitos } from './conflitos';

const ev = (id: string, extra: Partial<AppEvent> = {}): AppEvent => ({
  id,
  title: id,
  description: '',
  unit: 'DIC',
  event_type: 'reunião',
  start_datetime: '2026-03-21T11:00:00.000Z',
  end_datetime: '2026-03-21T13:00:00.000Z',
  location: '',
  status: 'confirmado',
  visibility: 'interno',
  has_conflict: false,
  created_by: 'x',
  created_at: '',
  updated_at: '',
  notes: '',
  marketing_request: false,
  partner_involved: false,
  partner_type: '',
  partner_name: '',
  partners: [],
  has_unit_collaboration: false,
  collaborating_units: [],
  external_collaborators: [],
  attachments: [],
  ...extra,
});

describe('conflitam', () => {
  it('mesma unidade, horários que se cruzam', () => {
    expect(conflitam(ev('a'), ev('b', { start_datetime: '2026-03-21T12:00:00.000Z', end_datetime: '2026-03-21T14:00:00.000Z' }))).toBe(true);
  });

  it('encostar não é cruzar: termina quando o outro começa', () => {
    expect(conflitam(ev('a'), ev('b', { start_datetime: '2026-03-21T13:00:00.000Z', end_datetime: '2026-03-21T15:00:00.000Z' }))).toBe(false);
  });

  it('unidades diferentes não conflitam — salvo a Administração, que conflita com todas', () => {
    expect(conflitam(ev('a'), ev('b', { unit: 'Santana' }))).toBe(false);
    expect(conflitam(ev('a'), ev('b', { unit: 'Administração' }))).toBe(true);
  });

  it('cancelado e lixeira ficam de fora', () => {
    expect(conflitam(ev('a'), ev('b', { status: 'cancelado' }))).toBe(false);
    expect(conflitam(ev('a'), ev('b', { deleted_at: '2026-03-22T00:00:00.000Z' }))).toBe(false);
  });

  it('um evento não conflita consigo mesmo', () => {
    expect(conflitam(ev('a'), ev('a'))).toBe(false);
  });

  it('data inválida não conflita com nada', () => {
    expect(conflitam(ev('a'), ev('b', { start_datetime: 'x' }))).toBe(false);
  });
});

describe('marcarConflitos', () => {
  it('marca os dois lados e ignora a bandeira velha do banco', () => {
    const lista = marcarConflitos([
      ev('a', { has_conflict: false }),
      ev('b', { has_conflict: false, start_datetime: '2026-03-21T12:00:00.000Z', end_datetime: '2026-03-21T14:00:00.000Z' }),
      // marcado no banco, mas movido para outro dia: a bandeira tem de cair
      ev('c', { has_conflict: true, start_datetime: '2026-03-28T11:00:00.000Z', end_datetime: '2026-03-28T13:00:00.000Z' }),
    ]);
    expect(lista.map(e => [e.id, e.has_conflict])).toEqual([['a', true], ['b', true], ['c', false]]);
  });

  it('conflitosDe devolve com quem, sem o próprio', () => {
    const todos = [ev('a'), ev('b'), ev('c', { unit: 'Santana' })];
    expect(conflitosDe(todos[0], todos).map(e => e.id)).toEqual(['b']);
  });
});
