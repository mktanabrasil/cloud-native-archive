import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAMPOS_PUBLICOS_DO_EVENTO, SELECT_PUBLICO } from './camposPublicos';

/**
 * A lista é o que separa o que a escola divulga do que a equipe combina entre
 * si. Ela não quebra sozinha: quebra quando alguém acrescenta um campo aqui
 * sem pensar, ou quando o `select` volta a ser `*`.
 */

/** Campos que não podem sair daqui de jeito nenhum. */
const PROIBIDOS = [
  'notes',
  'created_by',
  'updated_by',
  'target_audience',
  'support_team',
  'food_logistics',
  'equipment_needed',
  'printed_materials',
  'marketing_info',
  'marketing_items',
  'marketing_request',
  'marketing_coverage',
  'partner_involved',
  'partner_name',
  'partner_type',
  'partners',
  'transport_needed',
  'transport_vehicle',
  'transport_passengers',
  'transport_extra_equipment',
  'submitted_at',
  'reviewed_at',
  'reviewed_by',
  'review_note',
  'attachments',
  'external_id',
];

/** Campos sem os quais a tela pública deixa de funcionar. */
const NECESSARIOS = [
  'id',
  'title',
  'start_datetime',
  'end_datetime',
  'unit',
  'location',
  'status',
  'visibility',
  'slug',
];

describe('os campos públicos do evento', () => {
  it('não deixa escapar nada de planejamento interno', () => {
    for (const campo of PROIBIDOS) {
      expect(CAMPOS_PUBLICOS_DO_EVENTO as readonly string[], `"${campo}" não pode ser público`).not.toContain(campo);
    }
  });

  it('traz o que a vitrine precisa para montar o card', () => {
    for (const campo of NECESSARIOS) {
      expect(CAMPOS_PUBLICOS_DO_EVENTO as readonly string[]).toContain(campo);
    }
  });

  it('vira uma lista separada por vírgula, sem espaço', () => {
    // O PostgREST aceita espaço, mas ele vira %20 na URL e polui o log.
    expect(SELECT_PUBLICO).not.toMatch(/\s/);
    expect(SELECT_PUBLICO.split(',')).toHaveLength(CAMPOS_PUBLICOS_DO_EVENTO.length);
  });

  it('não repete campo', () => {
    expect(new Set(CAMPOS_PUBLICOS_DO_EVENTO).size).toBe(CAMPOS_PUBLICOS_DO_EVENTO.length);
  });
});

describe('a consulta do app', () => {
  it('só pede a linha inteira quando há sessão', () => {
    // O jeito de o vazamento voltar é alguém trocar isto por um `*` seco.
    const fonte = readFileSync('src/contexts/AppContext.tsx', 'utf8');

    expect(fonte).toContain("isAuthenticated ? '*' : SELECT_PUBLICO");
  });
});

describe('a migração de privilégios', () => {
  const sql = readFileSync('supabase/migrations/20260902130000_events_colunas_publicas.sql', 'utf8');

  it('concede ao anônimo exatamente os campos da lista', () => {
    const bloco = sql.slice(sql.indexOf('GRANT SELECT ('), sql.indexOf(') ON public.events TO anon'));
    const noSql = bloco
      .replace('GRANT SELECT (', '')
      .split(',')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('--'));

    expect(noSql.sort()).toEqual([...CAMPOS_PUBLICOS_DO_EVENTO].sort());
  });
});
