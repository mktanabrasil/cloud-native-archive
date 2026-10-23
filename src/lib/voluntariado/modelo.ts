/**
 * Voluntariado do Natal Feliz (20/10/2026; em etapas desde 23/10/2026).
 *
 * Link público, como o da Pizza da Alegria. Desde 23/10/2026 o formulário
 * abre para funcionários, o público e o Alcance JNI, em três etapas:
 *  1. o treinamento obrigatório de 28/11 no Manaim (quem não pode, para ali);
 *  2. nome, WhatsApp, horário (um só) e vínculo: funcionário(a) informa a
 *     unidade; quem não é nem funcionário nem do JNI diz quem da ANA indicou
 *     e, se quiser, a igreja;
 *  3. onde quer ajudar (1ª opção obrigatória, 2ª opcional), com as áreas do
 *     vínculo. Área que bateu a meta só entra como 2ª opção.
 * Inscrições até 15/11/2026. Os mesmos limites estão na função
 * `inscrever_voluntario` do banco, que também sorteia o protocolo (VL-XXXXX).
 */

import { UNIDADES_POR_AREA } from '@/lib/pizza/modelo';

/**
 * Os endereços (21/10/2026): cada campanha mora em /voluntariado/<campanha>.
 * Os antigos (/voluntariado e /voluntariado/acompanhar/…) redirecionam para cá,
 * porque o primeiro link já tinha sido divulgado.
 */
export const CAMINHO_DO_FORMULARIO = '/voluntariado/natalfeliz26';
export const caminhoDoAoVivo = (codigo: string) => `${CAMINHO_DO_FORMULARIO}/acompanhar/${codigo}`;

export const PRAZO = new Date('2026-11-16T00:00:00-03:00');
export const DIA_DO_EVENTO = '08/12';
export const ULTIMO_DIA = '15/11';

/**
 * O treinamento obrigatório (23/10/2026). Horário e endereço ainda não
 * foram passados: vazios, a tela e o comprovante mostram "a definir".
 * Quando chegarem, é só preencher aqui.
 */
export const TREINAMENTO = { data: 'Sábado, 28/11', dataCurta: '28/11', local: 'Manaim', horario: '', endereco: '' };

/** Os parceiros do Natal Feliz 2026 (21/10/2026: JNI, Nazateen e Hope Day). */
export const PARCEIROS = ['JNI', 'Nazateen', 'Hope Day'];
/** "JNI, Nazateen e Hope Day" */
export const parceirosPorExtenso = (l: readonly string[] = PARCEIROS) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l.join(''));

/**
 * O convite antes das perguntas (mockup "Dia do Voluntariado" aprovado em
 * 21/10/2026): para muita gente a ida é voluntária, então ele precisa
 * convidar, não só registrar.
 */
export const SOBRE_O_EVENTO = {
  titulo: 'Neste Natal, seja o presente de alguém',
  texto: `No dia 8 de dezembro, o Manaim se transforma para receber o Natal Feliz, em parceria com ${parceirosPorExtenso()}. É o nosso Dia do Voluntariado: um dia de abraços, sorrisos, brincadeiras e presentes para as famílias que atendemos.`,
  destaque: 'A participação é voluntária, e é isso que torna o dia tão especial: quem vai, vai porque escolheu fazer a diferença.',
  selos: ['Você escolhe onde quer ajudar', 'Leva menos de 2 minutos', 'O comprovante já traz os dados do treinamento'],
  chamada: 'Vem com a gente fazer parte dessa história?',
};

/** As áreas e a descrição de cada uma (textos aprovados em 23/10/2026). */
export const AREAS_DE_AJUDA = [
  { chave: 'cozinha', rotulo: 'Cozinha / Servimento', descricao: 'Auxiliar a equipe na preparação e no servimento de mais de 1.500 refeições, além das demais tarefas da cozinha, como lavar a louça e recolher o lixo.' },
  { chave: 'montagem', rotulo: 'Montagem / Desmontagem', descricao: 'Montar e desmontar mesas, cadeiras e demais estruturas do evento.' },
  { chave: 'decoracao', rotulo: 'Decoração', descricao: 'Decorar o espaço conforme a orientação da equipe responsável, de acordo com o tema do evento.' },
  { chave: 'limpeza_pre', rotulo: 'Limpeza pré-evento', descricao: 'Limpar e preparar todo o espaço antes do evento. Esta atividade acontece na segunda-feira, 07/12.' },
  { chave: 'inflaveis', rotulo: 'Brinquedos infláveis', descricao: 'Acompanhar as crianças nos brinquedos infláveis e organizar as filas e as turmas.' },
  { chave: 'estacoes', rotulo: 'Estações', descricao: 'Apoiar as estações de atividades durante o evento, como manicure e barbearia. Outras estações ainda podem ser incluídas.' },
  { chave: 'louvor_kids', rotulo: 'Louvor Kids', descricao: 'Para integrantes do Alcance JNI que servem no louvor: conduzir os momentos de louvor com as crianças.' },
  { chave: 'som', rotulo: 'Som', descricao: 'Para integrantes do Alcance JNI: auxiliar na montagem e na operação do som.' },
  { chave: 'recreacao_kids', rotulo: 'Recreação Kids', descricao: 'Para integrantes do Alcance JNI: conduzir as atividades de recreação com as crianças.' },
  { chave: 'presentes_kids', rotulo: 'Presentes Kids', descricao: 'Para integrantes do Alcance JNI: organizar os presentes e auxiliar na entrega às crianças.' },
] as const;

export type AreaDeAjuda = (typeof AREAS_DE_AJUDA)[number]['chave'];
export const rotuloDaAjuda = (k: string | null) => AREAS_DE_AJUDA.find((a) => a.chave === k)?.rotulo ?? (k ?? '');

export type Vinculo = 'funcionario' | 'alcance' | 'comunidade';

export const VINCULOS: ReadonlyArray<{ chave: Vinculo; rotulo: string; detalhe: string; curto: string }> = [
  { chave: 'funcionario', rotulo: 'Sou funcionário(a) da ANA', detalhe: '', curto: 'Funcionário(a) ANA' },
  { chave: 'alcance', rotulo: 'Faço parte do Alcance JNI', detalhe: 'parceiro do evento', curto: 'Alcance JNI' },
  { chave: 'comunidade', rotulo: 'Nenhum dos dois', detalhe: 'quero ajudar como voluntário(a)', curto: 'Voluntário(a)' },
];
export const rotuloDoVinculo = (v: string | null | undefined) => VINCULOS.find((x) => x.chave === v)?.curto ?? '';

/** As áreas de cada vínculo (23/10/2026). A função do banco tem a mesma lista. */
export const AREAS_POR_VINCULO: Record<Vinculo, readonly AreaDeAjuda[]> = {
  funcionario: ['cozinha', 'montagem', 'decoracao', 'limpeza_pre', 'inflaveis', 'estacoes'],
  alcance: ['cozinha', 'montagem', 'louvor_kids', 'som', 'limpeza_pre', 'recreacao_kids', 'inflaveis', 'presentes_kids'],
  comunidade: ['cozinha', 'montagem', 'limpeza_pre', 'inflaveis', 'estacoes'],
};
export const TITULO_DAS_AREAS: Record<Vinculo, string> = {
  funcionario: 'Áreas para funcionários da ANA',
  alcance: 'Áreas para o Alcance JNI',
  comunidade: 'Áreas abertas para voluntários',
};

/** Os horários, com as cores da legenda da planilha da coordenação. */
export type Horario = 'manha' | 'tarde' | 'dia_anterior' | 'pos_evento' | 'dia_todo';
export const HORARIOS: ReadonlyArray<{ chave: Horario; rotulo: string; detalhe: string; cor: string }> = [
  { chave: 'manha', rotulo: 'Manhã', detalhe: '7h às 12h', cor: '#F6C343' },
  { chave: 'tarde', rotulo: 'Tarde', detalhe: '12h às 17h', cor: '#3CB371' },
  { chave: 'dia_anterior', rotulo: 'Dia anterior', detalhe: 'Montagem e decoração', cor: '#4A7FD0' },
  { chave: 'pos_evento', rotulo: 'Pós-evento', detalhe: '17h às 20h', cor: '#3D3D3D' },
  { chave: 'dia_todo', rotulo: 'Dia todo', detalhe: '7h às 20h', cor: '#D9363E' },
];
export const rotuloDoHorario = (h: string | null | undefined) => HORARIOS.find((x) => x.chave === h)?.rotulo ?? '';

/**
 * As unidades da ANA Piauí ficam fora (21/10/2026). Continuam conhecidas no
 * resto do app; só não aparecem para escolher.
 */
export const UNIDADES_FORA_DO_VOLUNTARIADO: readonly string[] = ['ana-piaui'];

/** Só a Educação (GOE e CEIs) para os funcionários (21/10/2026, mantido em 23/10/2026). */
export const AREAS_DO_VOLUNTARIADO: readonly string[] = ['educacao'];

export const UNIDADES_DO_VOLUNTARIADO = UNIDADES_POR_AREA
  .filter((g) => AREAS_DO_VOLUNTARIADO.includes(g.area))
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

type Opcoes = { opcao1: AreaDeAjuda | null; opcao2: AreaDeAjuda | null };

/**
 * Tocar numa área: a 1ª vaga livre recebe (1ª, depois 2ª); tocar numa
 * marcada desmarca, e a 2ª sobe para 1ª se a 1ª saiu. Área lotada nunca vira
 * 1ª opção (23/10/2026): nem ao tocar, nem subindo da 2ª. Quem chama abre o
 * aviso quando o toque numa lotada pediria a 1ª.
 */
export function tocarArea(atual: Opcoes, area: AreaDeAjuda, lotadas: readonly string[] = []): Opcoes {
  const lotada = (a: AreaDeAjuda | null) => !!a && lotadas.includes(a);
  if (atual.opcao1 === area) return lotada(atual.opcao2) ? { opcao1: null, opcao2: atual.opcao2 } : { opcao1: atual.opcao2, opcao2: null };
  if (atual.opcao2 === area) return { opcao1: atual.opcao1, opcao2: null };
  if (lotada(area)) return { opcao1: atual.opcao1, opcao2: area };
  if (!atual.opcao1) return { opcao1: area, opcao2: atual.opcao2 };
  if (!atual.opcao2) return { opcao1: atual.opcao1, opcao2: area };
  // As duas ocupadas: a nova vira a 2ª.
  return { opcao1: atual.opcao1, opcao2: area };
}

/** O toque numa área lotada que pediria a 1ª opção: é aí que o aviso abre. */
export const pedeAvisoDeLotada = (atual: Opcoes, area: AreaDeAjuda, lotadas: readonly string[]) =>
  lotadas.includes(area) && !atual.opcao1 && atual.opcao2 !== area;

export interface DadosDaEtapa2 {
  nome: string;
  whatsapp: string;
  horario: Horario | null;
  vinculo: Vinculo | null;
  unidade: string | null;
  indicado: boolean | null;
  indicadoPor: string;
}

/** O que falta na etapa 2; null quando dá para seguir. */
export function problemaDaEtapa2(d: DadosDaEtapa2): string | null {
  if (d.nome.trim().length < 3 || !/\s/.test(d.nome.trim())) return 'Escreva o seu nome completo.';
  if (!whatsappValido(d.whatsapp)) return 'Confira o telefone (WhatsApp), com DDD.';
  if (!d.horario) return 'Escolha o horário em que você pode ajudar.';
  if (!d.vinculo) return 'Conte se você é funcionário(a) da ANA, do Alcance JNI ou nenhum dos dois.';
  if (d.vinculo === 'funcionario' && !d.unidade) return 'Escolha a unidade em que você trabalha.';
  if (d.vinculo === 'comunidade' && d.indicado === null) return 'Conte se alguém da ANA te indicou.';
  if (d.vinculo === 'comunidade' && d.indicado && d.indicadoPor.trim().length < 2) return 'Escreva o nome de quem te indicou.';
  return null;
}

/** Mensagem para quem se inscreveu, a partir do erro do banco. */
export function mensagemDoErro(e: unknown): string {
  const t = String((e as { message?: string })?.message ?? e);
  if (/prazo_encerrado/.test(t)) return `As inscrições foram encerradas em ${ULTIMO_DIA}.`;
  if (/ja_inscrito/.test(t)) return 'Este WhatsApp já está inscrito. Para mudar a área, fale com a equipe.';
  if (/whatsapp_invalido/.test(t)) return 'Confira o telefone (WhatsApp), com DDD.';
  if (/nome_invalido/.test(t)) return 'Confira o seu nome.';
  if (/area_lotada/.test(t)) return 'As vagas da sua 1ª opção acabaram de ser preenchidas. Escolha outra área como 1ª opção; essa pode ficar como 2ª.';
  return 'Não deu para enviar. Confira a internet e tente de novo.';
}
