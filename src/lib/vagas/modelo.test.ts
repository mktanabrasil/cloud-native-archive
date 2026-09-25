import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AREAS, CONTRATACOES, MODALIDADES, STATUS_DA_VAGA, TIPOS_DE_PERGUNTA, PROXIMOS_STATUS,
  codigoDaVaga, estaNaVitrine, podeIrPara, proximoCodigo, slugDaVaga, slugLivre,
} from './modelo';

describe('slug da vaga', () => {
  it('tira acento, caixa e pontuação', () => {
    expect(slugDaVaga('Educador Social de Música')).toBe('educador-social-de-musica');
    expect(slugDaVaga('  Auxiliar de Cozinha (Noturno) — PcD ')).toBe('auxiliar-de-cozinha-noturno-pcd');
  });

  it('cabe no formato que o banco aceita', () => {
    const slug = slugDaVaga('Á'.repeat(3) + ' x'.repeat(100));
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(slug.length).toBeLessThanOrEqual(80);
  });

  it('acrescenta número quando já existe', () => {
    expect(slugLivre('Professor', [])).toBe('professor');
    expect(slugLivre('Professor', ['professor', 'professor-2'])).toBe('professor-3');
    expect(slugLivre('!!!', [])).toBe('vaga');
  });
});

describe('código da vaga', () => {
  it('prefixo da área, ano e três dígitos', () => {
    expect(codigoDaVaga('social', 2026, 31)).toBe('SOC-2026-031');
    expect(codigoDaVaga('educacao', 2026, 4)).toBe('EDU-2026-004');
    expect(codigoDaVaga('administracao', 2026, 1200)).toBe('ADM-2026-1200');
  });

  it('o próximo conta só a mesma área no mesmo ano', () => {
    const existentes = ['SOC-2026-031', 'SOC-2026-009', 'SOC-2025-099', 'EDU-2026-050'];
    expect(proximoCodigo('social', 2026, existentes)).toBe('SOC-2026-032');
    expect(proximoCodigo('educacao', 2026, existentes)).toBe('EDU-2026-051');
    expect(proximoCodigo('administracao', 2026, existentes)).toBe('ADM-2026-001');
  });
});

describe('ciclo de vida', () => {
  it('publicada pausa ou encerra; arquivada só volta como rascunho', () => {
    expect(podeIrPara('publicada', 'pausada')).toBe(true);
    expect(podeIrPara('publicada', 'rascunho')).toBe(false);
    expect(PROXIMOS_STATUS.arquivada).toEqual(['rascunho']);
  });

  it('vitrine: publicada e dentro do prazo, se houver', () => {
    const agora = new Date('2026-09-25T12:00:00Z');
    expect(estaNaVitrine({ status: 'publicada', prazo: null }, agora)).toBe(true);
    expect(estaNaVitrine({ status: 'publicada', prazo: '2026-09-25T11:00:00Z' }, agora)).toBe(false);
    expect(estaNaVitrine({ status: 'pausada', prazo: null }, agora)).toBe(false);
  });
});

describe('o modelo bate com a migração', () => {
  const sql = readFileSync('supabase/migrations/20260925180000_vagas.sql', 'utf8');
  const lista = (nome: string) => {
    const m = sql.match(new RegExp(`CONSTRAINT ${nome} CHECK \\(\\w+ IN \\(([^)]*)\\)`));
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : null;
  };

  it('mesmas áreas, modalidades, contratações, status e tipos de pergunta', () => {
    expect(lista('vagas_area_check')).toEqual([...AREAS]);
    expect(lista('vagas_modalidade_check')).toEqual([...MODALIDADES]);
    expect(lista('vagas_contratacao_check')).toEqual([...CONTRATACOES]);
    expect(lista('vagas_status_check')).toEqual([...STATUS_DA_VAGA]);
    expect(lista('perguntas_de_vaga_tipo_check')).toEqual([...TIPOS_DE_PERGUNTA]);
  });

  it('só RH e admin escrevem; o público lê só a vaga publicada', () => {
    expect(sql).toMatch(/bond_type = 'rh'/);
    expect(sql).toMatch(/vagas_select_publico[\s\S]*?USING \(status = 'publicada'/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO anon/);
  });
});
