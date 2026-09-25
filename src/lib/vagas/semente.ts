import type { Area, Contratacao } from './modelo';

/**
 * As 42 vagas que estavam nos sites em 25/09/2026, para a importação (fase 1, PR 5).
 *
 * Lidas dos widgets Elfsight de anabrasil.org/ana/vagas/vagassocial (24) e
 * goe.anabrasil.org/vagas (18), com o Forms de cada uma. Os títulos saem
 * corrigidos como no inventário de 17/09: sem caixa alta, sem gênero, com a
 * grafia certa. O texto vem do site, com os erros de cópia consertados
 * (limpeza com descrição de cozinha, "Administrator", "n exercício").
 *
 * Três pares usam o mesmo Forms nos dois sites (Assistente de RH, Jovem
 * Aprendiz e PcD): a cópia da Educação vem marcada como `duplicadaDe`, e a
 * importação a deixa desmarcada, para a mesma vaga não aparecer duas vezes.
 * O Assistente de RH vai para Administração, que agora é área.
 *
 * "Serviços Gerais (vaga masculina)" perde a exigência de gênero: é
 * discriminatória e a publicação a barraria de qualquer jeito.
 */

export interface VagaDaSemente {
  /** Como estava no site, para o RH reconhecer. */
  original: string;
  titulo: string;
  area: Area;
  requisitos: string[];
  diferenciais?: string[];
  responsabilidades?: string[];
  link_externo: string;
  contratacao?: Contratacao;
  afirmativa_pcd?: boolean;
  aprendizagem?: boolean;
  /** O que mudou em relação ao site, mostrado na revisão. */
  nota?: string;
  /** Mesmo Forms de outra vaga da lista: fica desmarcada. */
  duplicadaDe?: string;
}

const SEIS_MESES = 'Experiência mínima de seis meses na função';
const f = (id: string) => `https://forms.gle/${id}`;

export const SEMENTE: VagaDaSemente[] = [
  // --- Social (anabrasil.org/ana/vagas/vagassocial) ---
  { original: 'DIGITADOR', titulo: 'Digitador', area: 'social', link_externo: f('DYgi5M5SZUP7GBNM6'),
    requisitos: ['Ensino Médio em curso ou concluído', 'Digitação rápida e precisa', 'Atenção aos detalhes na digitação e revisão de textos', 'Informática básica: Word, Excel e sistemas do dia a dia', 'Boa gramática e ortografia'],
    diferenciais: ['Capacidade de manter a concentração por longos períodos'] },
  { original: 'ASSISTENTE SOCIAL', titulo: 'Assistente Social', area: 'social', link_externo: f('fu3ifwykGZcLiS3N8'),
    requisitos: ['Ensino Superior em Serviço Social', SEIS_MESES] },
  { original: 'AUX. COZINHA', titulo: 'Auxiliar de Cozinha', area: 'social', link_externo: f('n35aPvaEbkrr7qiu6'),
    requisitos: ['Ensino Fundamental completo', 'Experiência mínima de seis meses em cozinha industrial'] },
  { original: 'AUX. LIMPEZA', titulo: 'Auxiliar de Limpeza', area: 'social', link_externo: f('kcridkLHCsQJEAVb9'),
    requisitos: ['Ensino Fundamental completo', SEIS_MESES], nota: 'O site repetia o texto da cozinha ("cozinha industrial").' },
  { original: 'ASSISTENTE DE RECURSOS HUMANOS (RH)', titulo: 'Assistente de Recursos Humanos', area: 'administracao', link_externo: f('FMNzShmkZb7JtKBh7'),
    requisitos: ['Ensino Médio completo'], diferenciais: ['Curso técnico ou superior em Recursos Humanos'], nota: 'Estava nos dois sites com o mesmo Forms; entra uma vez, em Administração.' },
  { original: 'AUX. ADMINISTRATIVO', titulo: 'Auxiliar Administrativo', area: 'social', link_externo: f('jYx2e8JFdYX1is738'),
    requisitos: ['Ensino Médio completo'] },
  { original: 'COORDENADOR TÉCNICO', titulo: 'Coordenador Técnico', area: 'social', link_externo: f('2KoC9Uafugzquegs5'),
    requisitos: ['Ensino Superior em Serviço Social, Psicologia, Pedagogia ou Administração', SEIS_MESES] },
  { original: 'COZINHEIRA', titulo: 'Cozinheiro', area: 'social', link_externo: f('p22EbADhXyjVBUjL6'),
    requisitos: ['Experiência mínima de seis meses em cozinha industrial'], nota: 'Título sem gênero.' },
  { original: 'EDUCADOR DO MUNDO DO TRABALHO', titulo: 'Educador do Mundo do Trabalho', area: 'social', link_externo: f('8t4ErzxCahDP16hu9'),
    requisitos: ['Ensino Médio completo', 'Experiência na área', SEIS_MESES], diferenciais: ['Graduação ou curso em Recursos Humanos ou Psicologia'] },
  { original: 'EDUCADOR DE ARTES', titulo: 'Educador Social de Artes', area: 'social', link_externo: f('EZe2fsGTPhdLkFoc6'),
    requisitos: ['Ensino Médio completo', 'Experiência na área', SEIS_MESES] },
  { original: 'EDUCADOR SOCIAL', titulo: 'Educador Social', area: 'social', link_externo: f('Wum7oCTg6cp5KVfq8'),
    requisitos: ['Ensino Médio', SEIS_MESES] },
  { original: 'EDUCADOR SOCIAL DE CIRCO', titulo: 'Educador Social de Circo', area: 'social', link_externo: f('3iDBqivZhvq9kF9XA'),
    requisitos: ['Ensino Médio completo', SEIS_MESES] },
  { original: 'EDUCADOR SOCIAL DE DANÇA', titulo: 'Educador Social de Dança', area: 'social', link_externo: f('yWoRC2hVxgH2prBS9'),
    requisitos: ['Ensino Médio', SEIS_MESES],
    responsabilidades: ['Dar aulas de dança', 'Criar coreografias, exercícios e alongamentos', 'Contar a história da dança para os participantes', 'Planejar as atividades e fazer os relatórios', 'Incentivar a criatividade'] },
  { original: 'EDUCADOR SOCIAL DE ESPORTE', titulo: 'Educador Social de Esporte', area: 'social', link_externo: f('MZwcFM97j5SQW5UPA'),
    requisitos: ['Ensino Médio', SEIS_MESES] },
  { original: 'EDUCADOR SOCIAL DE INFORMÁTICA', titulo: 'Educador Social de Informática', area: 'social', link_externo: f('axjj5sQKxaSpUNX38'),
    requisitos: ['Ensino Médio completo', SEIS_MESES] },
  { original: 'EDUCADOR SOCIAL DE MEIO AMBIENTE', titulo: 'Educador Social de Meio Ambiente', area: 'social', link_externo: f('i7G1jtWWVb6Qxenm6'),
    requisitos: ['Ensino Médio completo', SEIS_MESES] },
  { original: 'EDUCADOR SOCIAL DE MÚSICA', titulo: 'Educador Social de Música', area: 'social', link_externo: f('YnHfGEpS5oHwXCJW8'),
    requisitos: ['Ensino Médio', SEIS_MESES] },
  { original: 'EDUCADOR SOCIAL TEMÁTICO', titulo: 'Educador Social Temático', area: 'social', link_externo: f('bty4EKPWST98Hhqa8'),
    requisitos: ['Ensino Médio completo', SEIS_MESES] },
  { original: 'OFICINEIRO DE FANTOCHE', titulo: 'Oficineiro de Fantoche', area: 'social', link_externo: f('VNXUmcmGzfX3iddi7'),
    requisitos: ['Ensino Médio', SEIS_MESES] },
  { original: 'EDUCADOR DE AUTOCUIDADO', titulo: 'Educador de Autocuidado', area: 'social', link_externo: f('JESTKVPrCa8vhfHh6'),
    requisitos: ['Ensino Médio', SEIS_MESES] },
  { original: 'PSICÓLOGO SOCIAL', titulo: 'Psicólogo Social', area: 'social', link_externo: f('oej4pVyCkSx3mPxU9'),
    requisitos: ['Graduação completa em Psicologia', 'CRP ativo'] },
  { original: 'ZELADOR', titulo: 'Zelador', area: 'social', link_externo: f('N4LC4vxZ1y5jWdbe8'),
    requisitos: ['Ensino Fundamental completo', 'Experiência mínima de seis meses', 'Conhecimento em hidráulica, elétrica e alvenaria'] },
  { original: 'Jovem Apreniz', titulo: 'Jovem Aprendiz', area: 'social', link_externo: f('ZGKmMJGDe7sg7EQQA'), contratacao: 'aprendiz', aprendizagem: true,
    requisitos: ['Ter de 14 a 24 anos incompletos; para pessoas com deficiência, não há limite', 'Estar matriculado no Ensino Fundamental ou Médio, ou já ter concluído o Ensino Médio'],
    nota: 'Grafia corrigida. Estava nos dois sites com o mesmo Forms; entra uma vez.' },
  { original: 'Pessoa com Deficiência | PCD', titulo: 'Vagas para Pessoas com Deficiência', area: 'social', link_externo: f('QWPTX88cbrsvwPDx8'), afirmativa_pcd: true,
    requisitos: ['Ensino Fundamental', 'Experiência mínima de seis meses', 'Habilitação profissional'],
    nota: 'Estava nos dois sites com o mesmo Forms; entra uma vez.' },

  // --- Educação (goe.anabrasil.org/vagas) ---
  { original: 'DIRETORA', titulo: 'Diretor Escolar', area: 'educacao', link_externo: f('98Y1hUnt2Kz6W4jQ6'),
    requisitos: ['Licenciatura plena em Pedagogia, ou mestrado ou doutorado em Educação', 'Cinco anos de docência na Educação Básica, ou quatro anos em gestão escolar mais um de docência'], nota: 'Título sem gênero.' },
  { original: 'VICE-DIRETORA', titulo: 'Vice-diretor Escolar', area: 'educacao', link_externo: f('WfUc2WGFVUoXP6C59'),
    requisitos: ['Licenciatura plena em Pedagogia, ou mestrado ou doutorado em Educação', 'Três anos de docência na Educação Básica, ou dois anos em gestão escolar mais um de docência'], nota: 'Título sem gênero.' },
  { original: 'COORDENADORA PEDAGÓGICA', titulo: 'Coordenador Pedagógico', area: 'educacao', link_externo: f('CV9TWxuQieM8836GA'),
    requisitos: ['Licenciatura plena em Pedagogia, ou mestrado ou doutorado em Educação', 'Três anos de docência na Educação Básica, ou dois anos em gestão escolar mais um de docência'], nota: 'Título sem gênero.' },
  { original: 'PROFESSORA DE EDUCAÇÃO INFANTIL', titulo: 'Professor de Educação Infantil', area: 'educacao', link_externo: f('zS1Jyi7SHbyw1YpRA'),
    requisitos: ['Curso Normal Superior ou licenciatura em Pedagogia (Resolução CNE/CP nº 01/2006, quando for o caso)', 'Seis meses de docência na Educação Infantil'], nota: 'Título sem gênero.' },
  { original: 'PROFESSORA DE EDUCAÇÃO INFANTIL – ESPECIAL', titulo: 'Professor de Educação Infantil · Educação Especial', area: 'educacao', link_externo: f('yMQAqEZkVaBJ4qoo6'),
    requisitos: ['Pedagogia com habilitação em Educação Especial; ou Pedagogia com especialização, mestrado ou doutorado em Educação Especial; ou licenciatura em Educação Especial', 'Um ano na função'], nota: 'Título sem gênero.' },
  { original: 'AGENTE DE EDUCAÇÃO INFANTIL', titulo: 'Agente de Educação Infantil', area: 'educacao', link_externo: f('zPAiePyMg3XTyQnQA'),
    requisitos: ['Ensino Médio completo', SEIS_MESES] },
  { original: 'CUIDADOR', titulo: 'Cuidador', area: 'educacao', link_externo: f('i5wbLN6eyjeqhokm6'),
    requisitos: ['Ensino Médio completo', 'Curso de cuidador completo', SEIS_MESES] },
  { original: 'AUXILIAR ADMINISTRATIVO', titulo: 'Auxiliar Administrativo', area: 'educacao', link_externo: f('M231soxdoS5EpwNV9'),
    requisitos: ['Ensino Médio completo', 'Experiência mínima de seis meses', 'Pacote Office e Google Drive'] },
  { original: 'SECRETARIA', titulo: 'Secretário Escolar', area: 'educacao', link_externo: f('DuSgZPpjEqY3NGFw7'),
    requisitos: ['Ensino Médio completo', 'Experiência mínima de seis meses', 'Pacote Office e Google Drive', 'Boa comunicação verbal e escrita', 'Organização, proatividade e discrição'],
    diferenciais: ['Curso técnico ou superior em áreas administrativas ou educacionais', 'Experiência anterior na área escolar'],
    responsabilidades: ['Fazer matrículas, rematrículas e transferências', 'Manter os registros escolares em dia', 'Emitir declarações, certificados e boletins', 'Atender pais, alunos e professores', 'Organizar e arquivar os documentos escolares', 'Ajudar a preparar reuniões, eventos e atividades', 'Cuidar das exigências dos órgãos da educação'],
    nota: 'O site pedia Pedagogia num campo e Ensino Médio no outro; ficou o Ensino Médio, com o superior como diferencial. Confira.' },
  { original: 'ASSISTENTE DE RECURSOS HUMANOS (RH)', titulo: 'Assistente de Recursos Humanos', area: 'administracao', link_externo: f('FMNzShmkZb7JtKBh7'),
    requisitos: ['Ensino Médio completo'], duplicadaDe: 'Assistente de Recursos Humanos' },
  { original: 'COZINHEIRA', titulo: 'Cozinheiro', area: 'educacao', link_externo: f('csWy7H7QZU9dqLGUA'),
    requisitos: ['Ensino Fundamental completo', 'Experiência mínima de seis meses em cozinha industrial'], nota: 'Título sem gênero.' },
  { original: 'AUXILIAR DE COZINHA', titulo: 'Auxiliar de Cozinha', area: 'educacao', link_externo: f('bByAkuKqyzfKF38u5'),
    requisitos: ['Ensino Fundamental completo', 'Experiência mínima de seis meses em cozinha industrial'] },
  { original: 'SERVENTE DE LIMPEZA', titulo: 'Auxiliar de Limpeza', area: 'educacao', link_externo: f('Dx4vNAmYrxLWG9kw7'),
    requisitos: ['Ensino Fundamental completo', SEIS_MESES] },
  { original: 'ZELADOR', titulo: 'Zelador', area: 'educacao', link_externo: f('9bP2AiCQDMvj1AYn6'),
    requisitos: ['Ensino Fundamental completo', 'Experiência mínima de seis meses', 'Conhecimento em hidráulica, elétrica e alvenaria'] },
  { original: 'SERVIÇO GERAIS (vaga masculina)', titulo: 'Auxiliar de Serviços Gerais', area: 'educacao', link_externo: f('9bP2AiCQDMvj1AYn6'),
    requisitos: ['Ensino Médio completo', 'Experiência mínima de seis meses', 'Conhecimento em hidráulica, elétrica e alvenaria'],
    nota: 'Saiu "vaga masculina": exigência de gênero é discriminatória. No site ela abre o mesmo Forms do Zelador.' },
  { original: 'PORTEIRO', titulo: 'Porteiro', area: 'educacao', link_externo: f('PA4KcGaPSNPe8n257'),
    requisitos: ['Ensino Médio completo', 'Boa comunicação, pontualidade e postura profissional'], diferenciais: ['Experiência na função'] },
  { original: 'Jovem Aprendiz', titulo: 'Jovem Aprendiz', area: 'social', link_externo: f('ZGKmMJGDe7sg7EQQA'), contratacao: 'aprendiz', aprendizagem: true,
    requisitos: ['Ter de 14 a 24 anos incompletos; para pessoas com deficiência, não há limite'], duplicadaDe: 'Jovem Aprendiz' },
  { original: 'Pessoa com Deficiência | PCD', titulo: 'Vagas para Pessoas com Deficiência', area: 'social', link_externo: f('QWPTX88cbrsvwPDx8'), afirmativa_pcd: true,
    requisitos: ['Ensino Fundamental'], duplicadaDe: 'Vagas para Pessoas com Deficiência' },
];
