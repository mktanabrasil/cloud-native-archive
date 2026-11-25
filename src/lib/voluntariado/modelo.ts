/**
 * Voluntariado do Natal Feliz (20/10/2026; em etapas desde 23/10/2026).
 *
 * Link público, como o da Pizza da Alegria. Desde 23/10/2026 o formulário
 * abre para funcionários, o público e a INCC, em três etapas:
 *  1. o treinamento obrigatório de 28/11 no Recanto Maanaim (quem não pode, para ali);
 *  2. nome, WhatsApp, horário (um só) e vínculo: funcionário(a) informa a
 *     unidade; quem não é nem funcionário nem do JNI diz se alguém da ANA ou da INCC indicou
 *     e, se quiser, a igreja;
 *  3. onde quer ajudar (1ª opção obrigatória, 2ª opcional), com as áreas do
 *     vínculo. Área que bateu a meta só entra como 2ª opção.
 * Inscrições até 26/11/2026 (eram até 15/11; prorrogadas para 18/11 em 12/11
 * e para 26/11 em 23/11/2026).
 * Os mesmos limites estão na função
 * `inscrever_voluntario` do banco, que também sorteia o protocolo (VL-XXXXX).
 */

import { ROTULO_DA_AREA, UNIDADES_POR_AREA } from '@/lib/pizza/modelo';

/**
 * Os endereços (21/10/2026): cada campanha mora em /voluntariado/<campanha>.
 * Os antigos (/voluntariado e /voluntariado/acompanhar/…) redirecionam para cá,
 * porque o primeiro link já tinha sido divulgado.
 */
export const CAMINHO_DO_FORMULARIO = '/voluntariado/natalfeliz26';
export const caminhoDoAoVivo = (codigo: string) => `${CAMINHO_DO_FORMULARIO}/acompanhar/${codigo}`;

export const PRAZO = new Date('2026-11-27T00:00:00-03:00');
export const DIA_DO_EVENTO = '08/12';
export const ULTIMO_DIA = '26/11';

/**
 * O treinamento obrigatório (23/10/2026), no mesmo local do evento. O horário
 * ainda está sendo confirmado: vazio, a tela e o comprovante mostram "a
 * confirmar". Quando chegar, é só preencher aqui.
 * Grafia: Maanaim, com dois "a" (23/10/2026).
 */
export const TREINAMENTO = {
  data: 'Sábado, 28/11',
  dataCurta: '28/11',
  local: 'Recanto Maanaim',
  horario: '',
  endereco: 'Rua Arcebispo Dom Luciano Mendes de Almeida, 50 - Swiss Park, Campinas - SP, 13049-446',
};
/** O endereço no Google Maps, para abrir no celular. */
export const MAPA_DO_TREINAMENTO = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${TREINAMENTO.local}, ${TREINAMENTO.endereco}`)}`;

/** Os parceiros do Natal Feliz 2026 (JNI, Nazateen e, desde 09/11/2026, INCC; a Hope Day saiu em 23/10/2026). */
export const PARCEIROS = ['JNI', 'Nazateen', 'INCC'];
/** "JNI, Nazateen e Hope Day" */
export const parceirosPorExtenso = (l: readonly string[] = PARCEIROS) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l.join(''));

/**
 * O convite antes das perguntas (mockup "Dia do Voluntariado" aprovado em
 * 21/10/2026): para muita gente a ida é voluntária, então ele precisa
 * convidar, não só registrar.
 */
export const SOBRE_O_EVENTO = {
  titulo: 'Neste Natal, seja o presente de alguém',
  texto: `No dia 8 de dezembro, o Recanto Maanaim se transforma para receber o Natal Feliz, em parceria com ${parceirosPorExtenso()}. É o nosso Dia do Voluntariado: um dia de abraços, sorrisos, brincadeiras e presentes para as crianças que atendemos.`,
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
  { chave: 'louvor_kids', rotulo: 'Louvor Kids', descricao: 'Para integrantes da INCC que servem no louvor: conduzir os momentos de louvor com as crianças.' },
  { chave: 'som', rotulo: 'Som', descricao: 'Para integrantes da INCC: auxiliar na montagem e na operação do som.' },
  { chave: 'recreacao_kids', rotulo: 'Recreação Kids', descricao: 'Para integrantes da INCC: conduzir as atividades de recreação com as crianças.' },
  { chave: 'presentes_kids', rotulo: 'Presentes Kids', descricao: 'Para integrantes da INCC: organizar os presentes e auxiliar na entrega às crianças.' },
  // 12/11/2026, pedido dele: área nova, para funcionários e voluntários.
  { chave: 'ccii', rotulo: 'CCII', descricao: 'Trabalho com os idosos: apoiar as atividades com eles durante o evento.' },
  // 12/11/2026, pedido dele (mockup aprovado): crianças atípicas (autistas e afins),
  // para funcionários e voluntários. "Atípicas" é o termo das próprias famílias.
  { chave: 'atipicas', rotulo: 'Crianças atípicas', descricao: 'Acompanhar e apoiar as crianças atípicas, como as autistas, nas atividades do evento, com acolhimento e respeito ao ritmo de cada uma.' },
] as const;

export type AreaDeAjuda = (typeof AREAS_DE_AJUDA)[number]['chave'];

/**
 * O roteiro da cozinha por horário (28/10/2026): ao escolher o horário, a
 * descrição da área passa a dizer o que a pessoa vai fazer nele. O Dia todo
 * junta os três turnos. As outras áreas ainda não têm roteiro.
 */
export const ROTEIRO_POR_HORARIO: Partial<Record<AreaDeAjuda, Partial<Record<Horario, string>>>> = {
  cozinha: {
    manha: 'Das 7h às 12h: cortar frutas, lavar saladas, preparar o café da manhã e o almoço e ajudar a servir as refeições.',
    tarde: 'Das 12h às 17h: ajudar a lavar a louça, organizar talheres e pratos, preparar o lanche da tarde e servir os refrigerantes.',
    pos_evento: 'Das 17h às 20h: limpar a cozinha, organizar o refeitório e guardar talheres e itens da cozinha.',
    dia_todo: 'Das 7h às 20h, um pouco de tudo: de manhã, preparar o café e o almoço (cortar frutas, lavar saladas) e ajudar a servir; à tarde, lavar a louça, organizar talheres e pratos, preparar o lanche e servir os refrigerantes; no fim do dia, limpar a cozinha e organizar o refeitório.',
  },
};

/** A descrição da área: o roteiro do horário escolhido, se houver; senão, a de sempre. */
export const descricaoDaArea = (chave: AreaDeAjuda, horario: Horario | null | undefined) =>
  (horario && ROTEIRO_POR_HORARIO[chave]?.[horario]) || AREAS_DE_AJUDA.find((a) => a.chave === chave)?.descricao || '';
export const rotuloDaAjuda = (k: string | null) => AREAS_DE_AJUDA.find((a) => a.chave === k)?.rotulo ?? (k ?? '');

export type Vinculo = 'funcionario' | 'alcance' | 'comunidade';

export const VINCULOS: ReadonlyArray<{ chave: Vinculo; rotulo: string; detalhe: string; curto: string }> = [
  { chave: 'funcionario', rotulo: 'Sou funcionário(a) da ANA', detalhe: '', curto: 'Funcionário(a) ANA' },
  { chave: 'alcance', rotulo: 'Faço parte da INCC', detalhe: 'Alcance JNI e os demais ministérios', curto: 'INCC' },
  { chave: 'comunidade', rotulo: 'Nenhum dos dois', detalhe: 'quero ajudar como voluntário(a)', curto: 'Voluntário(a)' },
];
export const rotuloDoVinculo = (v: string | null | undefined) => VINCULOS.find((x) => x.chave === v)?.curto ?? '';

/**
 * As áreas de cada vínculo. A função do banco tem a mesma lista.
 * Desde 23/10/2026, só o que acontece no dia do evento: montagem, decoração
 * e limpeza ficam com os funcionários, no dia anterior, como dia trabalhado.
 */
export const AREAS_POR_VINCULO: Record<Vinculo, readonly AreaDeAjuda[]> = {
  funcionario: ['cozinha', 'inflaveis', 'estacoes', 'ccii', 'atipicas'],
  alcance: ['cozinha', 'louvor_kids', 'som', 'recreacao_kids', 'inflaveis', 'presentes_kids'],
  comunidade: ['cozinha', 'inflaveis', 'estacoes', 'ccii', 'atipicas'],
};

/**
 * Fora do formulário desde 23/10/2026. Continuam conhecidas (rótulo, planilha,
 * painéis) para quem já tiver escolhido; só não aparecem mais para escolher.
 */
export const AREAS_FORA_DO_FORMULARIO: readonly string[] = ['montagem', 'decoracao', 'limpeza_pre'];
/** A área entra nos painéis se está no formulário ou se alguém já a escolheu. */
export const areaNosPaineis = (chave: string, escolhidas: Iterable<string | null>) =>
  !AREAS_FORA_DO_FORMULARIO.includes(chave) || [...escolhidas].includes(chave);

/** O grupo dos voluntários no WhatsApp (23/10/2026): a entrada é obrigatória. */
export const GRUPO_DO_WHATSAPP = 'https://chat.whatsapp.com/FnmKMVE3PXnEWKVYQY7ZEe';
export const TITULO_DAS_AREAS: Record<Vinculo, string> = {
  funcionario: 'Áreas para funcionários da ANA',
  alcance: 'Áreas para a INCC',
  comunidade: 'Áreas abertas para voluntários',
};

/**
 * Os horários, com as cores da legenda da planilha da coordenação. O "Dia
 * anterior" saiu do formulário em 23/10/2026 (o voluntariado é só no dia do
 * evento); continua conhecido para o rótulo de quem já o escolheu.
 */
export type Horario = 'manha' | 'tarde' | 'dia_anterior' | 'pos_evento' | 'dia_todo';
type DadosDoHorario = { chave: Horario; rotulo: string; detalhe: string; cor: string };
const DIA_ANTERIOR: DadosDoHorario = { chave: 'dia_anterior', rotulo: 'Dia anterior', detalhe: 'Montagem e decoração', cor: '#4A7FD0' };
export const HORARIOS: ReadonlyArray<DadosDoHorario> = [
  { chave: 'manha', rotulo: 'Manhã', detalhe: '7h às 12h', cor: '#F6C343' },
  { chave: 'tarde', rotulo: 'Tarde', detalhe: '12h às 17h', cor: '#3CB371' },
  { chave: 'pos_evento', rotulo: 'Pós-evento', detalhe: '17h às 20h', cor: '#3D3D3D' },
  { chave: 'dia_todo', rotulo: 'Dia todo', detalhe: '7h às 20h', cor: '#D9363E' },
];
export const dadosDoHorario = (h: string | null | undefined) => [...HORARIOS, DIA_ANTERIOR].find((x) => x.chave === h);
export const rotuloDoHorario = (h: string | null | undefined) => dadosDoHorario(h)?.rotulo ?? '';
/** O texto da pergunta do horário (23/10/2026). */
export const TEXTO_DO_HORARIO = 'O Natal Feliz vai das 7h às 17h. Algumas áreas também precisam de ajuda depois do evento, das 17h às 20h: por isso o Pós-evento e o Dia todo (7h às 20h) estão na lista. Escolha uma opção.';

/**
 * As unidades da ANA Piauí ficam fora (21/10/2026). Continuam conhecidas no
 * resto do app; só não aparecem para escolher.
 */
export const UNIDADES_FORA_DO_VOLUNTARIADO: readonly string[] = ['ana-piaui'];

/** Só a Educação (GOE e CEIs) para os funcionários (21/10/2026, mantido em 23/10/2026). */
export const AREAS_DO_VOLUNTARIADO: readonly string[] = ['educacao'];

/**
 * Fora da Educação, mas no formulário (25/11/2026, a pedido): o Escritório
 * (ADM), como na Pizza. Se inscreve como as demais unidades (a área gravada
 * continua a dele, Social), mas na lista fica num grupo próprio.
 */
export const UNIDADES_ALEM_DAS_AREAS: readonly string[] = ['escritorio-adm'];
/** O grupo dessas unidades na lista (25/11/2026, a pedido): "ANA Brasil", não "Social". */
export const GRUPO_ALEM_DAS_AREAS = 'ANA Brasil';

/** Os grupos da lista de unidades: `chave` para o React, `rotulo` para a tela. */
export const UNIDADES_DO_VOLUNTARIADO = [
  ...UNIDADES_POR_AREA
    .filter((g) => AREAS_DO_VOLUNTARIADO.includes(g.area))
    .map((g) => ({ chave: g.area as string, rotulo: ROTULO_DA_AREA[g.area], unidades: g.unidades.filter((u) => !UNIDADES_FORA_DO_VOLUNTARIADO.includes(u.id)) })),
  {
    chave: 'ana-brasil',
    rotulo: GRUPO_ALEM_DAS_AREAS,
    unidades: UNIDADES_POR_AREA.flatMap((g) => g.unidades).filter((u) => UNIDADES_ALEM_DAS_AREAS.includes(u.id) && !UNIDADES_FORA_DO_VOLUNTARIADO.includes(u.id)),
  },
].filter((g) => g.unidades.length > 0);

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

/**
 * Acompanhantes (23/11/2026): quem leva pessoa idosa ou criança informa nome e
 * idade de cada uma (até 4). Vão para a coluna "Acompanhantes" da planilha da
 * coordenação. A função inscrever_voluntario confere o mesmo.
 */
export type TipoDeAcompanhante = 'idoso' | 'crianca';
export interface AcompanhanteNaTela { tipo: '' | TipoDeAcompanhante; nome: string; idade: string }
export interface Acompanhante { tipo: TipoDeAcompanhante; nome: string; idade: number }
export const MAX_ACOMPANHANTES = 4;
export const ROTULO_DO_ACOMPANHANTE: Record<TipoDeAcompanhante, string> = { idoso: 'pessoa idosa', crianca: 'criança' };

/** O que falta nos acompanhantes, ou null. `leva` undefined: a pergunta não se aplica. */
export function problemaDosAcompanhantes(leva: boolean | null | undefined, lista: AcompanhanteNaTela[] = []): string | null {
  if (leva === undefined) return null;
  if (leva === null) return 'Conte se vai levar acompanhante.';
  if (!leva) return null;
  if (!lista.length) return 'Acrescente o acompanhante, ou marque "Não".';
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i], n = lista.length > 1 ? `Acompanhante ${i + 1}: ` : 'Acompanhante: ';
    if (!a.tipo) return `${n}escolha se é pessoa idosa ou criança.`;
    if (a.nome.trim().length < 2) return `${n}escreva o nome.`;
    if (!/^\d{1,3}$/.test(a.idade.trim()) || Number(a.idade) > 120) return `${n}escreva a idade.`;
  }
  return null;
}

/** Os acompanhantes como vão para o banco (só quando leva). */
export const acompanhantesParaEnviar = (leva: boolean | null | undefined, lista: AcompanhanteNaTela[] = []): Acompanhante[] =>
  leva ? lista.filter((a): a is AcompanhanteNaTela & { tipo: TipoDeAcompanhante } => !!a.tipo).map(a => ({ tipo: a.tipo, nome: a.nome.trim().replace(/\s+/g, ' '), idade: Number(a.idade) })) : [];

/** "Maria Souza, 72 anos (pessoa idosa)", um por linha (comprovante e planilha). */
export const textoDosAcompanhantes = (lista: Acompanhante[]) =>
  lista.map(a => `${a.nome}, ${a.idade} ${a.idade === 1 ? 'ano' : 'anos'} (${ROTULO_DO_ACOMPANHANTE[a.tipo]})`).join('\n');

export interface DadosDaEtapa2 {
  nome: string;
  whatsapp: string;
  horario: Horario | null;
  vinculo: Vinculo | null;
  unidade: string | null;
  indicado: boolean | null;
  indicadoPor: string;
  /** Desde 23/10/2026 a igreja é obrigatória para quem é de fora: Sim/Não e, se sim, qual. */
  temIgreja?: boolean | null;
  igreja?: string;
  /** Desde 12/11/2026: quem não foi indicado conta como ficou sabendo (obrigatório). */
  comoSoube?: string;
  /** Desde 23/11/2026: leva acompanhante? (pessoa idosa ou criança, com nome e idade). */
  levaAcompanhante?: boolean | null;
  acompanhantes?: AcompanhanteNaTela[];
}

/** O que falta na etapa 2; null quando dá para seguir. */
export function problemaDaEtapa2(d: DadosDaEtapa2): string | null {
  if (d.nome.trim().length < 3 || !/\s/.test(d.nome.trim())) return 'Escreva o seu nome completo.';
  if (!whatsappValido(d.whatsapp)) return 'Confira o telefone (WhatsApp), com DDD.';
  if (!d.horario) return 'Escolha o horário em que você pode ajudar.';
  if (!d.vinculo) return 'Conte se você é funcionário(a) da ANA, da INCC ou nenhum dos dois.';
  if (d.vinculo === 'funcionario' && !d.unidade) return 'Escolha a unidade em que você trabalha.';
  if (d.vinculo === 'comunidade' && d.indicado === null) return 'Conte se alguém da ANA ou da INCC te indicou.';
  if (d.vinculo === 'comunidade' && d.indicado && d.indicadoPor.trim().length < 2) return 'Escreva o nome de quem te indicou.';
  if (d.vinculo === 'comunidade' && d.indicado === false && (d.comoSoube ?? '').trim().length < 2) return 'Conte como você ficou sabendo do voluntariado.';
  if (d.vinculo === 'comunidade' && (d.temIgreja === null || d.temIgreja === undefined)) return 'Conte se você faz parte de alguma igreja.';
  if (d.vinculo === 'comunidade' && d.temIgreja && (d.igreja ?? '').trim().length < 2) return 'Escreva o nome da sua igreja.';
  return problemaDosAcompanhantes(d.levaAcompanhante, d.acompanhantes);
}

/**
 * "Indicado por" e "Igreja" como a coordenação lê (12/11/2026). Para quem é
 * de fora (comunidade), o "Não" aparece escrito, e quem não foi indicado leva
 * junto como ficou sabendo. Antes, a célula ficava vazia e parecia falha.
 * Funcionários e INCC não respondem essas perguntas: fica vazio. A função
 * voluntariado-planilha repete esta regra (Deno não importa daqui).
 */
export interface RespostasDeFora { vinculo: string | null; indicado_por: string | null; igreja: string | null; como_soube?: string | null }
export const textoDaIndicacao = (i: RespostasDeFora): string =>
  i.vinculo !== 'comunidade' ? '' : i.indicado_por || (i.como_soube ? `Não · soube: ${i.como_soube}` : 'Não');
export const textoDaIgreja = (i: RespostasDeFora): string =>
  i.vinculo !== 'comunidade' ? '' : i.igreja || 'Não';

/** Mensagem para quem se inscreveu, a partir do erro do banco. */
export function mensagemDoErro(e: unknown): string {
  const t = String((e as { message?: string })?.message ?? e);
  if (/prazo_encerrado/.test(t)) return `As inscrições foram encerradas em ${ULTIMO_DIA}.`;
  if (/ja_inscrito/.test(t)) return 'Este WhatsApp já está inscrito. Para mudar a área, fale com a equipe.';
  if (/whatsapp_invalido/.test(t)) return 'Confira o telefone (WhatsApp), com DDD.';
  if (/nome_invalido/.test(t)) return 'Confira o seu nome.';
  if (/acompanhante_invalido/.test(t)) return 'Confira os acompanhantes: pessoa idosa ou criança, com nome e idade (até 4).';
  if (/area_lotada/.test(t)) return 'As vagas da sua 1ª opção acabaram de ser preenchidas. Escolha outra área como 1ª opção; essa pode ficar como 2ª.';
  return 'Não deu para enviar. Confira a internet e tente de novo.';
}
