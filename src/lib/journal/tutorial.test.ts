import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PERCURSOS, esquecerTutoriais, jaViu, marcarVisto, type PercursoId } from './tutorial';

/**
 * O tutorial só ensina se o holofote cair em cima de alguma coisa.
 *
 * O jeito de ele quebrar não é dar erro: é o passo apontar para um
 * `data-tutorial` que alguém renomeou, e o cartão aparecer no meio da tela
 * falando de um botão que a diretora não consegue achar. Ninguém vê isso numa
 * revisão de código — por isso o teste abaixo lê as telas de verdade.
 */

const TELAS: Record<PercursoId, string> = {
  listagem: 'src/pages/JournalPage.tsx',
  editor: 'src/components/journal/JournalEditor.tsx',
};

const ancorasDe = (arquivo: string): Set<string> => {
  const fonte = readFileSync(arquivo, 'utf8');
  const achadas = fonte.matchAll(/data-tutorial="([^"]+)"/g);
  return new Set([...achadas].map((m) => m[1]));
};

describe('os passos apontam para âncoras que existem', () => {
  it.each(Object.keys(PERCURSOS) as PercursoId[])('percurso %s', (percurso) => {
    const ancoras = ancorasDe(TELAS[percurso]);

    for (const passo of PERCURSOS[percurso]) {
      expect(ancoras, `passo "${passo.titulo}" aponta para "${passo.alvo}"`).toContain(passo.alvo);
    }
  });

  it('não deixa âncora marcada na tela sem nenhum passo usando', () => {
    // O contrário também conta: âncora órfã é sinal de passo apagado por engano.
    for (const percurso of Object.keys(PERCURSOS) as PercursoId[]) {
      const usados = new Set(PERCURSOS[percurso].map((p) => p.alvo));
      for (const ancora of ancorasDe(TELAS[percurso])) {
        expect(usados, `âncora "${ancora}" em ${TELAS[percurso]}`).toContain(ancora);
      }
    }
  });
});

describe('os textos', () => {
  const todos = Object.values(PERCURSOS).flat();

  it('nenhum passo vem vazio', () => {
    for (const passo of todos) {
      expect(passo.titulo.trim().length).toBeGreaterThan(0);
      expect(passo.texto.trim().length).toBeGreaterThan(0);
    }
  });

  it('cada percurso é curto o bastante para alguém terminar', () => {
    // Passou de doze passos, ela pula. O limite é da paciência, não do código.
    for (const passos of Object.values(PERCURSOS)) {
      expect(passos.length).toBeGreaterThan(0);
      expect(passos.length).toBeLessThanOrEqual(12);
    }
  });
});

describe('a marca de já visto', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('começa sem marca nenhuma', () => {
    expect(jaViu('listagem')).toBe(false);
    expect(jaViu('editor')).toBe(false);
  });

  it('marca um percurso sem marcar o outro', () => {
    marcarVisto('listagem');

    expect(jaViu('listagem')).toBe(true);
    expect(jaViu('editor')).toBe(false);
  });

  it('esquecer devolve os dois ao início', () => {
    marcarVisto('listagem');
    marcarVisto('editor');

    esquecerTutoriais();

    expect(jaViu('listagem')).toBe(false);
    expect(jaViu('editor')).toBe(false);
  });

  it('navegador sem armazenamento não derruba a página', () => {
    // Aba anônima com cookies bloqueados: o getItem/setItem lança.
    const explodir = () => {
      throw new Error('storage bloqueado');
    };
    const ler = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(explodir);
    const gravar = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(explodir);
    const apagar = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(explodir);

    expect(() => marcarVisto('editor')).not.toThrow();
    expect(() => esquecerTutoriais()).not.toThrow();
    expect(jaViu('editor')).toBe(false);

    ler.mockRestore();
    gravar.mockRestore();
    apagar.mockRestore();
  });
});
