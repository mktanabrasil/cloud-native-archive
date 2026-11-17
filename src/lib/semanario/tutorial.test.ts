import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROTEIROS_DO_SEMANARIO, type RoteiroDoSemanario } from './tutorial';

/**
 * O tutorial do Semanário (17/11/2026), no molde do teste do Jornal: lê as
 * telas de verdade e quebra se um passo apontar para um `data-tutorial` que
 * não existe, ou se uma âncora ficar sem passo.
 */
const COMUM = 'src/components/semanario/TutorialDoSemanario.tsx';
const TELAS: Record<RoteiroDoSemanario, string[]> = {
  'semanario-inicio': ['src/components/semanario/ListaDaProfessora.tsx', COMUM],
  'semanario-ficha': ['src/components/semanario/FichaDoSemanario.tsx', COMUM],
  'semanario-orientadora': ['src/components/semanario/ListaDaUnidade.tsx', 'src/components/semanario/PedidosDeProfessoras.tsx', COMUM],
};

const ancorasDe = (arquivos: string[]) => new Set(arquivos.flatMap((a) => {
  const fonte = readFileSync(a, 'utf8');
  return [...fonte.matchAll(/data-tutorial(?:="([^"]+)"|=\{[^}]*?'([^']+)')/g)].map((m) => m[1] ?? m[2]);
}));
const roteiros = Object.keys(ROTEIROS_DO_SEMANARIO) as RoteiroDoSemanario[];

describe('os passos apontam para âncoras que existem', () => {
  it.each(roteiros)('roteiro %s', (r) => {
    const ancoras = ancorasDe(TELAS[r]);
    for (const passo of ROTEIROS_DO_SEMANARIO[r]) {
      expect(ancoras, `passo "${passo.titulo}" aponta para "${passo.alvo}"`).toContain(passo.alvo);
    }
  });

  it('nenhuma âncora das telas fica sem passo', () => {
    for (const r of roteiros) {
      const usados = new Set(ROTEIROS_DO_SEMANARIO[r].map((p) => p.alvo));
      for (const ancora of ancorasDe(TELAS[r].filter((a) => a !== COMUM))) {
        expect(usados, `âncora "${ancora}" de ${r}`).toContain(ancora);
      }
    }
  });
});

describe('os textos', () => {
  it('nenhum passo vazio, nenhum roteiro comprido demais', () => {
    for (const passos of Object.values(ROTEIROS_DO_SEMANARIO)) {
      expect(passos.length).toBeGreaterThan(0);
      expect(passos.length).toBeLessThanOrEqual(12);
      for (const p of passos) {
        expect(p.titulo.trim()).not.toBe('');
        expect(p.texto.trim()).not.toBe('');
      }
    }
  });

  it('agrupamento escrito como na Educação, nunca "Maternal" ou "Berçário"', () => {
    const tudo = JSON.stringify(ROTEIROS_DO_SEMANARIO);
    expect(tudo).not.toMatch(/maternal|berçário/i);
    expect(tudo).toContain('AG I A');
  });
});
