import type { Area } from './modelo';

/**
 * O ícone do trabalho no cartão da vaga (modelo 1, versão B, aprovado em
 * 28/09/2026) e o jeito como ele se mexe ao passar o mouse.
 *
 * Sai do título, por palavra-chave, na ordem: o primeiro que casa ganha
 * ("Professor de Educação Infantil · Educação Especial" é professor antes de
 * ser educação). Sem palavra conhecida, fica o ícone da área.
 */

export type IconeDoTrabalho =
  | 'music' | 'dumbbell' | 'laptop' | 'tent' | 'palette' | 'leaf' | 'drama' | 'heart-pulse' | 'lightbulb'
  | 'briefcase' | 'chef-hat' | 'sparkles' | 'wrench' | 'door-open' | 'book-open' | 'school' | 'heart-handshake'
  | 'brain' | 'hand-heart' | 'users' | 'clipboard-list' | 'keyboard' | 'graduation-cap' | 'accessibility' | 'calculator';

/** Os movimentos (classes vg-mov-* no index.css). */
export type MovimentoDoIcone = 'danca' | 'pula' | 'balanca' | 'aperta' | 'folheia' | 'joga' | 'brilha' | 'gira';

const REGRAS: Array<[RegExp, IconeDoTrabalho, MovimentoDoIcone]> = [
  [/jovem aprendiz/i, 'graduation-cap', 'joga'],
  [/defici[eê]ncia|\bpcd\b/i, 'accessibility', 'gira'],
  [/m[uú]sica/i, 'music', 'danca'],
  [/dan[cç]a/i, 'music', 'danca'],
  [/esporte/i, 'dumbbell', 'pula'],
  [/inform[aá]tica/i, 'laptop', 'pula'],
  [/circo/i, 'tent', 'balanca'],
  [/artes?\b/i, 'palette', 'balanca'],
  [/meio ambiente/i, 'leaf', 'balanca'],
  [/fantoche/i, 'drama', 'balanca'],
  [/autocuidado/i, 'heart-pulse', 'pula'],
  [/tem[aá]tico/i, 'lightbulb', 'brilha'],
  [/mundo do trabalho/i, 'briefcase', 'pula'],
  [/cozinh/i, 'chef-hat', 'balanca'],
  [/limpeza/i, 'sparkles', 'brilha'],
  [/zelador|servi[cç]os gerais|manuten/i, 'wrench', 'aperta'],
  [/porteiro/i, 'door-open', 'balanca'],
  [/professor/i, 'book-open', 'folheia'],
  [/diretor|coordenador pedag/i, 'school', 'pula'],
  [/cuidador/i, 'heart-handshake', 'pula'],
  [/psic[oó]log/i, 'brain', 'brilha'],
  [/assistente social/i, 'hand-heart', 'pula'],
  [/recursos humanos|\brh\b/i, 'users', 'pula'],
  [/financeir/i, 'calculator', 'pula'],
  [/digitador/i, 'keyboard', 'pula'],
  [/administrativ|secret[aá]ri|coordenador t[eé]cnico/i, 'clipboard-list', 'folheia'],
  [/educador social|agente de educa/i, 'users', 'pula'],
];

const DA_AREA: Record<Area, IconeDoTrabalho> = { social: 'users', educacao: 'book-open', administracao: 'briefcase' };

export function iconeDaVaga(titulo: string, area: Area): { icone: IconeDoTrabalho; movimento: MovimentoDoIcone } {
  for (const [re, icone, movimento] of REGRAS) if (re.test(titulo)) return { icone, movimento };
  return { icone: DA_AREA[area], movimento: 'pula' };
}

/**
 * A frase da faixa de baixo: o começo da descrição, ou, sem descrição, o
 * primeiro requisito. Curta, para caber em duas linhas no cartão.
 */
export function fraseDaVaga(descricao: string, requisitos: string[], max = 72): string {
  // Sem descrição (as vagas importadas do site não têm), o primeiro requisito, dito como tal.
  const base = descricao.trim() ? descricao.trim().split(/(?<=[.!?])\s/)[0] : requisitos[0] ? `Requisito: ${requisitos[0]}` : '';
  const limpa = base.replace(/\s+/g, ' ').trim();
  if (limpa.length <= max) return limpa;
  const corte = limpa.slice(0, max);
  return corte.slice(0, corte.lastIndexOf(' ')).replace(/[,;:·-]+$/, '') + '…';
}
