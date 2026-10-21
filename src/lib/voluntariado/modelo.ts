/**
 * Voluntariado do Natal Feliz (20/10/2026): inscrição dos funcionários.
 *
 * Link público, como o da Pizza da Alegria. A pessoa informa o nome
 * completo, o WhatsApp, a unidade em que trabalha e onde quer ajudar no
 * Natal Feliz de 08/12/2026: 1ª opção obrigatória, 2ª opcional, sem limite
 * por área. Inscrições até 15/11/2026. Os mesmos limites estão na função
 * `inscrever_voluntario` do banco, que também sorteia o protocolo (VL-XXXXX).
 */

import { UNIDADES_POR_AREA } from '@/lib/pizza/modelo';

export const PRAZO = new Date('2026-11-16T00:00:00-03:00');
export const DIA_DO_EVENTO = '08/12';
export const ULTIMO_DIA = '15/11';

/** O bloco antes da primeira pergunta (mockup aprovado em 21/10/2026). */
export const SOBRE_O_EVENTO = {
  titulo: 'Natal Feliz 2026 · Manaim',
  texto: 'No dia 8 de dezembro, o Manaim recebe o Natal Feliz, em parceria com a JNI: um dia de celebração, solidariedade e união entre as unidades da ANA, para proporcionar às famílias que atendemos uma experiência inesquecível. Para isso acontecer, contamos com você!',
};

export const GRUPOS = [
  { grupo: 'Alimentação', areas: [
    ['cozinha', 'Cozinha / Servimento', 'Auxiliar a equipe na preparação e no servimento das refeições.'],
  ] },
  { grupo: 'Estrutura', areas: [
    ['montagem', 'Montagem / Desmontagem', 'Montar e desmontar mesas, cadeiras e estruturas.'],
    ['decoracao', 'Decoração', 'Decorar os espaços com o tema do Natal.'],
    ['logistica', 'Logística', 'Organizar materiais e espaços, levando o necessário a cada área.'],
    ['som', 'Som', 'Apoio na montagem e operação do som.'],
    ['projecao', 'Projeção', 'Apoio com telão, projetor e o que for exibido.'],
  ] },
  { grupo: 'Crianças e famílias', areas: [
    ['recreacao_kids', 'Recreação Kids', 'Auxílio nas atividades e apoio com as crianças durante a programação.'],
    ['inflaveis', 'Brinquedos infláveis', 'Acompanhar as crianças nos infláveis, organizando filas e turmas.'],
    ['atividades_adultos', 'Atividades adultos', 'Apoio nas atividades para os adultos e responsáveis.'],
    ['presentes_kids', 'Presentes Kids', 'Organizar e entregar os presentes às crianças.'],
  ] },
  { grupo: 'Cuidado e acolhimento', areas: [
    ['intercessao', 'Intercessão / Suporte espiritual', 'Oração pelo evento e acolhimento espiritual a quem precisar.'],
    ['alojamentos', 'Alojamentos', 'Organizar e cuidar dos alojamentos usados no dia.'],
  ] },
  { grupo: 'Limpeza', areas: [
    ['limpeza_pre', 'Limpeza pré-evento', 'Limpar e preparar os espaços antes da chegada das famílias.'],
    ['limpeza_durante', 'Limpeza durante o evento', 'Manter banheiros e espaços limpos ao longo do dia.'],
    ['limpeza_pos', 'Limpeza pós-evento', 'Limpar e organizar os espaços ao final.'],
  ] },
  { grupo: 'Acesso e segurança', areas: [
    ['estacionamento', 'Estacionamento', 'Orientar a chegada e a saída dos veículos.'],
    ['seguranca', 'Segurança', 'Apoio na segurança e na orientação do público nos acessos.'],
  ] },
] as const;

export type AreaDeAjuda = (typeof GRUPOS)[number]['areas'][number][0];
export const AREAS_DE_AJUDA = GRUPOS.flatMap((g) => g.areas.map(([k, r, d]) => ({ chave: k as AreaDeAjuda, rotulo: r as string, descricao: d as string, grupo: g.grupo as string })));
export const rotuloDaAjuda = (k: string | null) => AREAS_DE_AJUDA.find((a) => a.chave === k)?.rotulo ?? (k ?? '');

/**
 * Fora do formulário a pedido da coordenação (21/10/2026): a área Som e a
 * unidade ANA Piauí. Continuam conhecidas (rótulo, planilha, painel), para
 * quem já tiver se inscrito; só não aparecem mais para escolher.
 */
export const AREAS_FORA_DO_FORMULARIO: readonly string[] = ['som'];
export const UNIDADES_FORA_DO_VOLUNTARIADO: readonly string[] = ['ana-piaui'];

/** Os grupos do formulário, sem as áreas tiradas (e sem grupo vazio). */
export const GRUPOS_DO_FORMULARIO = GRUPOS
  .map((g) => ({ grupo: g.grupo as string, areas: g.areas.filter(([k]) => !AREAS_FORA_DO_FORMULARIO.includes(k)) as ReadonlyArray<readonly [AreaDeAjuda, string, string]> }))
  .filter((g) => g.areas.length > 0);

/** As unidades do formulário: as das campanhas, menos as tiradas do voluntariado. */
export const UNIDADES_DO_VOLUNTARIADO = UNIDADES_POR_AREA
  .map((g) => ({ ...g, unidades: g.unidades.filter((u) => !UNIDADES_FORA_DO_VOLUNTARIADO.includes(u.id)) }))
  .filter((g) => g.unidades.length > 0);

export const encerrado = (agora: Date = new Date()) => agora >= PRAZO;

/** Só os dígitos, sem o 55 do Brasil. */
export const digitosDoWhatsapp = (t: string) => {
  const d = t.replace(/\D/g, '');
  return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d;
};
export const whatsappValido = (t: string) => /^[1-9]\d{9,10}$/.test(digitosDoWhatsapp(t));

/** "(19) 99355-8242" enquanto a pessoa digita. */
export function mascaraDoWhatsapp(t: string): string {
  const d = t.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Tocar numa área: a 1ª vaga livre recebe (1ª, depois 2ª); tocar numa
 * marcada desmarca, e a 2ª sobe para 1ª se a 1ª saiu.
 */
export function tocarArea(atual: { opcao1: AreaDeAjuda | null; opcao2: AreaDeAjuda | null }, area: AreaDeAjuda): { opcao1: AreaDeAjuda | null; opcao2: AreaDeAjuda | null } {
  if (atual.opcao1 === area) return { opcao1: atual.opcao2, opcao2: null };
  if (atual.opcao2 === area) return { opcao1: atual.opcao1, opcao2: null };
  if (!atual.opcao1) return { opcao1: area, opcao2: atual.opcao2 };
  if (!atual.opcao2) return { opcao1: atual.opcao1, opcao2: area };
  // As duas ocupadas: a nova vira a 2ª.
  return { opcao1: atual.opcao1, opcao2: area };
}

/** O que falta para enviar; null quando está tudo certo. */
export function problemaDaInscricao(d: { nome: string; whatsapp: string; unidade: string | null; opcao1: AreaDeAjuda | null }): string | null {
  if (d.nome.trim().length < 3 || !/\s/.test(d.nome.trim())) return 'Escreva o seu nome completo.';
  if (!whatsappValido(d.whatsapp)) return 'Confira o WhatsApp, com DDD.';
  if (!d.unidade) return 'Escolha a unidade em que você trabalha.';
  if (!d.opcao1) return 'Escolha onde você quer ajudar.';
  return null;
}

/** Mensagem para quem se inscreveu, a partir do erro do banco. */
export function mensagemDoErro(e: unknown): string {
  const t = String((e as { message?: string })?.message ?? e);
  if (/prazo_encerrado/.test(t)) return `As inscrições foram encerradas em ${ULTIMO_DIA}.`;
  if (/ja_inscrito/.test(t)) return 'Este WhatsApp já está inscrito. Para mudar a área, fale com a equipe.';
  if (/whatsapp_invalido/.test(t)) return 'Confira o WhatsApp, com DDD.';
  if (/nome_invalido/.test(t)) return 'Confira o seu nome.';
  return 'Não deu para enviar. Confira a internet e tente de novo.';
}
