import type { AppEvent, VoluntarioDoEvento } from '@/types';

/**
 * A equipe do dia de um evento (18/11/2026, setor Administração, PR 2).
 *
 * Em "Quem vai ajudar no dia?", marcar **Funcionários** pede os nomes de quem
 * vai trabalhar (para o RH controlar o banco de horas depois) e marcar
 * **Voluntários** pede nome e WhatsApp de cada um (para o Voluntariado
 * cadastrar). Os nomes são obrigatórios. Confirmado o evento, a unidade ainda
 * pode trocar só essas listas (`trocar_equipe_do_evento` no banco).
 */

export const FUNCIONARIOS = 'Funcionários';
export const VOLUNTARIOS = 'Voluntários';
/** Os mesmos tetos do banco (`equipe_*_valida`). */
export const LIMITE_DE_PESSOAS = 80;
export const LIMITE_DO_NOME = 120;

const marcados = (supportTeam: string | null | undefined) => (supportTeam ?? '').split(', ').map(v => v.trim()).filter(Boolean);
export const temFuncionarios = (supportTeam: string | null | undefined) => marcados(supportTeam).includes(FUNCIONARIOS);
export const temVoluntarios = (supportTeam: string | null | undefined) => marcados(supportTeam).includes(VOLUNTARIOS);

/** Só os dígitos; tira o 55 do país quando vem com ele (como no voluntariado). */
export function digitosDoWhatsapp(texto: string): string {
  const d = texto.replace(/\D/g, '');
  return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d;
}
export const whatsappValido = (texto: string) => /^\d{10,11}$/.test(digitosDoWhatsapp(texto));

/** "(19) 99812-4410", ou o texto como veio se não tiver 10 ou 11 dígitos. */
export function formatarWhatsapp(texto: string): string {
  const d = digitosDoWhatsapp(texto);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return texto;
}

const chave = (nome: string) => nome.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Nomes aparados, sem vazios e sem repetir (sem olhar acento nem maiúscula). */
export function limparFuncionarios(nomes: readonly string[] | null | undefined): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const n of nomes ?? []) {
    const nome = n.replace(/\s+/g, ' ').trim().slice(0, LIMITE_DO_NOME);
    if (!nome || vistos.has(chave(nome))) continue;
    vistos.add(chave(nome));
    saida.push(nome);
  }
  return saida.slice(0, LIMITE_DE_PESSOAS);
}

/** Linhas aparadas, WhatsApp só com dígitos; linha toda vazia sai. */
export function limparVoluntarios(lista: readonly VoluntarioDoEvento[] | null | undefined): VoluntarioDoEvento[] {
  return (lista ?? [])
    .map(v => ({ nome: (v.nome ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITE_DO_NOME), whatsapp: digitosDoWhatsapp(v.whatsapp ?? '') }))
    .filter(v => v.nome || v.whatsapp)
    .slice(0, LIMITE_DE_PESSOAS);
}

/**
 * O que falta na equipe para enviar, ou nada. Só vale para o que está
 * marcado: desligar "Funcionários" não pede nome nenhum.
 */
export function erroDaEquipe(supportTeam: string | null | undefined, funcionarios: readonly string[] | null | undefined, voluntarios: readonly VoluntarioDoEvento[] | null | undefined): string | null {
  if (temFuncionarios(supportTeam) && limparFuncionarios(funcionarios).length === 0) {
    return 'Escreva o nome de quem da equipe vai trabalhar (o RH precisa saber).';
  }
  if (temVoluntarios(supportTeam)) {
    const v = limparVoluntarios(voluntarios);
    if (v.length === 0) return 'Escreva o nome e o WhatsApp de cada voluntário.';
    if (v.some(x => !x.nome)) return 'Falta o nome de um voluntário.';
    if (v.some(x => !/^\d{10,11}$/.test(x.whatsapp))) return 'Confira o WhatsApp dos voluntários: com DDD, 10 ou 11 números.';
  }
  return null;
}

/** As listas como vão para o banco: só o que está marcado. */
export function equipeParaGravar(supportTeam: string | null | undefined, funcionarios: readonly string[] | null | undefined, voluntarios: readonly VoluntarioDoEvento[] | null | undefined) {
  return {
    equipe_funcionarios: temFuncionarios(supportTeam) ? limparFuncionarios(funcionarios) : [],
    equipe_voluntarios: temVoluntarios(supportTeam) ? limparVoluntarios(voluntarios) : [],
  };
}

type ComEquipe = Pick<AppEvent, 'support_team' | 'equipe_funcionarios' | 'equipe_voluntarios'>;
/** O que vai ser gravado mudou em relação ao evento salvo? (marcação ou listas) */
export function equipeDiferente(salvo: ComEquipe, agora: ComEquipe): boolean {
  const a = equipeParaGravar(salvo.support_team, salvo.equipe_funcionarios, salvo.equipe_voluntarios);
  const b = equipeParaGravar(agora.support_team, agora.equipe_funcionarios, agora.equipe_voluntarios);
  return temFuncionarios(salvo.support_team) !== temFuncionarios(agora.support_team)
    || temVoluntarios(salvo.support_team) !== temVoluntarios(agora.support_team)
    || JSON.stringify(a) !== JSON.stringify(b);
}

/** Os nomes que a equipe já usou em outros eventos, para sugerir (mesma grafia ajuda o RH). */
export function nomesJaUsados(eventos: readonly Pick<AppEvent, 'equipe_funcionarios'>[]): string[] {
  return limparFuncionarios(eventos.flatMap(e => e.equipe_funcionarios ?? [])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
