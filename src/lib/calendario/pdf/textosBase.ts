/**
 * Os textos das páginas 2 a 10 do Calendário Anual (13/11/2026).
 *
 * Vieram do PDF de 2026, como estavam, para as coordenadoras revisarem. Duas
 * mudanças: o título da página do educador (em 2026 repetia o da página
 * anterior) e as marcas {ano}, {tema} e {TEMA}, que o PDF troca pelo ano e
 * pelo tema do ano. A tabela dos percursos não está aqui: ela sai dos
 * percursos de cada mês.
 *
 * Marcação do corpo: uma linha por parágrafo, "- " no começo vira item de
 * lista, **assim** vira negrito, linha em branco dá um respiro.
 */
export interface SecaoDoTexto {
  id: string;
  titulo: string;
  /** 1: título grande (15 pt); 2: subtítulo (12 pt). */
  nivel: 1 | 2;
  /** Começa numa página nova, como em 2026. */
  novaPagina: boolean;
  /** Espaçamento mais apertado, como nas páginas das unidades e da metodologia de 2026. */
  compacto?: boolean;
  corpo: string;
}

export const SECOES_DO_TEXTO: SecaoDoTexto[] = [
  {
    id: 'scfv',
    titulo: "SERVIÇO DE CONVIVÊNCIA E FORTALECIMENTO DE VÍNCULOS - SCFV",
    nivel: 1,
    novaPagina: true,
    corpo: `Trata-se de um serviço da Proteção Social Básica do SUAS, regulamentado pela Tipificação Nacional de Serviços Socioassistenciais (Resolução CNAS no 109/2009). Foi reordenado em 2013 por meio da Resolução CNAS no 01/2013. Esse Serviço é ofertado de forma complementar ao trabalho social com famílias que é realizado por meio do Serviço de Proteção e Atendimento Integral à Família (PAIF) e do Serviço de Proteção e Atendimento Especializado às Famílias e Indivíduos (PAEFI). O SCFV possui caráter preventivo, protetivo e proativo frente a situações de vulnerabilidades e riscos sociais e relacionais que possam resultar em rompimento dos vínculos familiares e comunitários. É um dos serviços que materializam as seguranças socioassistenciais de acolhida e de convívio familiar e comunitário, além de estimular o desenvolvimento de autonomia, realizando um trabalho para a aquisição de competências pessoais e relacionais pelos participantes.`,
  },
  {
    id: 'objetivos-do-servico',
    titulo: "OBJETIVOS DO SERVIÇO",
    nivel: 1,
    novaPagina: false,
    corpo: `- Complementar o trabalho social com famílias, prevenindo a ocorrência de situações de risco social e fortalecendo a convivência familiar e comunitária;
- Prevenir a institucionalização e a segregação de crianças, adolescentes, jovens e idosos, em especial, das pessoas com deficiência, assegurando o direito à convivência familiar e comunitária;
- Promover acessos a benefícios e serviços socioassistenciais, fortalecendo a rede de proteção social de assistência social nos territórios;
- Promover acessos a serviços setoriais, em especial das políticas de educação, saúde, cultura, esporte e lazer existentes no território, contribuindo para o usufruto dos usuários aos demais direitos;
- Oportunizar o acesso às informações sobre direitos e sobre participação cidadã, estimulando o desenvolvimento do protagonismo dos usuários;
- Possibilitar acessos a experiências e manifestações artísticas, culturais, esportivas e de lazer, com vistas ao desenvolvimento de novas sociabilidades.`,
  },
  {
    id: 'objetivos-6-a-15',
    titulo: "OS OBJETIVOS DO SCFV OFERTADO A CRIANÇAS E ADOLESCENTES DE 6 A 15 ANOS SÃO:",
    nivel: 1,
    novaPagina: false,
    corpo: `- Complementar as ações da família e da comunidade na proteção e no desenvolvimento de crianças e adolescentes e no fortalecimento dos vínculos familiares e sociais;
- Assegurar espaços de referência para o convívio grupal, comunitário e social e o desenvolvimento de relações de afetividade, solidariedade e respeito mútuo;
- Possibilitar a ampliação do universo informacional, artístico e cultural das crianças e adolescentes, bem como estimular o desenvolvimento de potencialidades, habilidades, talentos e propiciar sua formação cidadã;
- Estimular a participação na vida pública do território e desenvolver competências para a compreensão crítica da realidade social e do mundo moderno;
- Contribuir para a inserção, reinserção e permanência no sistema educacional.`,
  },
  {
    id: 'eixos',
    titulo: "QUAIS SÃO OS EIXOS QUE ORIENTAM A EXECUÇÃO DO SCFV?",
    nivel: 1,
    novaPagina: true,
    corpo: `O SCFV é organizado a partir dos ciclos de vida dos usuários, atentando-se às especificidades – características, necessidades, potencialidades e desafios - de cada etapa do desenvolvimento. Todavia, há aspectos da vida humana que perpassam todas essas etapas e que integram os eixos orientadores do SCFV.`,
  },
  {
    id: 'eixos-orientadores',
    titulo: "ESTES SÃO OS EIXOS ORIENTADORES DO SCFV:",
    nivel: 2,
    novaPagina: false,
    corpo: `**I. O eixo “Eu comigo”** visa atender os interesses, as demandas e as necessidades próprias dos usuários. Para isso, é preciso compreender as particularidades de cada estágio da vida para oportunizar as falas, as expressões e as manifestações, tendo em vista romper com visões que desqualificam suas potencialidades, aptidões e interesses. Para o eixo “Eu comigo”, o SCFV propõe atividades que contribuem no desenvolvimento de competências individuais, visando o atendimento de suas necessidades e o estímulo de suas potências. As competências relacionadas a esse eixo são: aprender com a experiência, autoconfiança, autoconhecimento, autocontrole, autoestima, automotivação, autonomia, aprender a brincar, resiliência e responsabilidade.
**II. O eixo “Eu com os outros”** enfatiza a importância da construção e do fortalecimento das redes de apoio social dos usuários, visando prevenir a sua segregação e/ ou institucionalização e assegurar o direito à convivência familiar e comunitária. É a partir do convívio familiar, comunitário e social que se busca o desenvolvimento de relações de afetividade, solidariedade e respeito. O objetivo principal deste eixo é que os participantes possam conhecer, experimentar e reforçar as competências sociais que colaboram com a convivência no meio familiar e comunitário, bem como com a sua integração nas variadas redes sociais. Além disso, o eixo busca fortalecer o sentimento de pertença e identidade, bem como refletir sobre condições e aspectos da vida em sociedade. As competências relacionadas a esse eixo são: comunicação, cooperação, empatia, resolução de conflitos, respeito e sociabilidade.
**III. O eixo “Eu com a cidade”** propõe que os usuários se compreendam como cidadãos – sujeitos de direitos e deveres, agentes, interventores, partícipes – nos espaços em que estabelecem relações sociais – a sua moradia, a sua escola, o próprio SCFV, os locais que costumam frequentar no cotidiano, etc. Esse eixo tem como objetivo estimular as competências que mobilizam a participação social e a comunicação dos usuários acerca das vivências no território, de modo que atuem nas situações do Serviço e ampliem sua participação para outros contextos. Entre as competências relacionadas a este eixo, estão: apropriação, direitos e deveres, participação ativa, pertencimento e viver em redes. Além dos eixos apresentados, que orientam as conversações e fazeres junto aos participantes de todas as faixas etárias do Serviço, para o trabalho com crianças de 0 a 6 anos, crianças e adolescentes de 6 a 15 anos, adolescentes de 15 a 17 anos e pessoas idosas, há um eixo específico que contempla as características dessas etapas da vida.(Caderno de perguntas SCFV)`,
  },
  {
    id: 'para-6-a-15',
    titulo: "PARA CRIANÇAS E ADOLESCENTES DE 6 A 15 ANOS:",
    nivel: 1,
    novaPagina: false,
    corpo: `Para a faixa etária de 6 a 14 anos, o SCFV objetiva promover a convivência, a formação para a participação e cidadania, o desenvolvimento do protagonismo e da autonomia das crianças e adolescentes, a partir dos interesses, das demandas e das potencialidades dessa faixa etária. As intervenções devem ser pautadas em **experiências lúdicas, culturais e esportivas** como formas de expressão, interação, aprendizagem, sociabilidade e proteção social, conforme prevê a Tipificação Nacional de Serviços Socioassistenciais (Resolução CNAS n° 109/2009).`,
  },
  {
    id: 'objetivos-do-servico-2',
    titulo: "OBJETIVOS DO SERVIÇO",
    nivel: 1,
    novaPagina: true,
    corpo: `- Fortalecer vínculos familiares e comunitários por meio de atividades que promovam convivência, inclusão e participação social;
- Prevenir situações de isolamento, negligência, discriminação e rompimento de vínculos;
- Favorecer o acesso dos usuários à rede socioassistencial e aos demais serviços públicos do território;
- Estimular a autonomia, a autoestima, o protagonismo e o exercício da cidadania;
- Desenvolver ações que valorizem a diversidade geracional e promovam a troca de saberes, culturas e experiências;
- Contribuir para a garantia de direitos e para a proteção social dos usuários atendidos.`,
  },
  {
    id: 'situacoes-prioritarias',
    titulo: "QUAIS SÃO AS SITUAÇÕES PRIORITÁRIAS PARA O ATENDIMENTO NO SCFV?",
    nivel: 2,
    novaPagina: false,
    corpo: `Segundo a Resolução CIT no 01/2013 e a Resolução CNAS no 01/2013, considera-se público prioritário para o atendimento no SCFV crianças e/ou adolescentes e/ou pessoas idosas nas seguintes situações:
- Em situação de isolamento;
- Trabalho infantil;
- Vivência de violência e/ou negligência;
- Fora da escola ou com defasagem escolar superior a 2 (dois) anos;
- Em situação de acolhimento;
- Em cumprimento de medida socioeducativa em meio aberto;
- Egressos de medidas socioeducativas;
- Situação de abuso e/ou exploração sexual;
- Com medidas de proteção do ECA;
- Crianças e adolescentes em situação de rua;
- Vulnerabilidade que diz respeito às pessoas com deficiência.`,
  },
  {
    id: 'educador',
    titulo: "EDUCADOR/ORIENTADOR SOCIAL",
    nivel: 1,
    novaPagina: true,
    corpo: `Trata-se de profissional com, no mínimo, nível médio de escolaridade, conforme dispõe a Resolução CNAS no 09/2014. É o mediador dos grupos do SCFV com atuação constante junto aos usuários, sendo responsável pela criação de um ambiente de convivência participativo e democrático. Destacam-se as seguintes atribuições desse profissional:
- Desenvolver atividades socioeducativas e de convivência e socialização visando à atenção, defesa e garantia de direitos;
- Organizar, facilitar oficinas e desenvolver atividades individuais e coletivas de vivência nas unidades e/ou, na comunidade;
- Acompanhar, orientar e monitorar os usuários na execução das atividades;
- Apoiar na organização de eventos artísticos, lúdicos e culturais nas unidades e/ou na comunidade;
- Participar das reuniões de equipe para o planejamento das atividades, avaliação de processos, fluxos de trabalho e resultado;
- Desenvolver atividades que contribuam com a prevenção de rompimentos de vínculos familiares e comunitários, possibilitando a superação de situações de fragilidade social vivenciadas;
- Acompanhar com regularidade os encaminhamentos realizados no âmbito do Serviço;
- Acompanhar e registrar a assiduidade dos usuários por meio de instrumentais específicos, como listas de frequência, atas, sistemas eletrônicos próprios, etc.`,
  },
  {
    id: 'projeto',
    titulo: "PROJETO {ano} - {TEMA}.",
    nivel: 2,
    novaPagina: false,
    corpo: `**Identificação do projeto**
Título: “{tema}”
Unidade executora: Nome da unidade
Serviço: Serviço de Convivência e Fortalecimento de Vínculos – SCFV, Centro Convivência Inclusivo e Intergeracional - CCII
Público-alvo: Crianças, adolescentes, idosos, famílias, etc.
Período de execução: Janeiro de {ano} à Dezembro de {ano}`,
  },
  {
    id: 'quem-somos',
    titulo: "QUEM SOMOS (COM BREVE RELATO DO TERRITÓRIO)",
    nivel: 1,
    novaPagina: true,
    corpo: `O ANA Brasil é uma Organização da Sociedade Civil que há mais de 40 anos atua na promoção do desenvolvimento social de crianças, adolescentes e famílias, contribuindo para a construção de comunidades mais justas, acolhedoras e cheias de oportunidades.
Nossa atuação está inserida na Proteção Social Básica do Sistema Único de Assistência Social (SUAS), por meio do Serviço de Convivência e Fortalecimento de Vínculos (SCFV), que tem como objetivo prevenir situações de vulnerabilidade social, fortalecer vínculos familiares e comunitários e promover o desenvolvimento integral dos participantes.
Ao longo de nossa trajetória, construímos espaços de convivência, aprendizado e cuidado, onde crianças e adolescentes têm a oportunidade de desenvolver habilidades, descobrir talentos, fortalecer sua autoestima e ampliar suas perspectivas de futuro. Por meio de oficinas educativas, culturais, esportivas e socioeducativas, incentivamos o protagonismo, a cidadania e a construção de relações baseadas no respeito, na cooperação e na solidariedade.
Mais do que oferecer atividades, o ANA Brasil busca fortalecer redes de apoio, promover pertencimento e contribuir para o desenvolvimento humano e social nos territórios onde atua.
Atualmente, o trabalho da organização acontece em três unidades localizadas na cidade de Campinas: ANA Nilópolis, ANA DIC e ANA Santana. Cada unidade está inserida em contextos territoriais específicos, marcados por diferentes realidades sociais e desafios, o que orienta o desenvolvimento de ações alinhadas às necessidades das comunidades atendidas. Além disso, o ANA Brasil também conta com uma unidade no estado do Piauí, na cidade de São Raimundo Nonato, ampliando seu alcance e impacto social.
A partir dessa presença nos territórios, o ANA Brasil desenvolve um trabalho comprometido com a proteção social, o fortalecimento de vínculos e a ampliação de oportunidades para crianças, adolescentes e suas famílias.`,
  },
  {
    id: 'ana-1',
    titulo: "ANA I",
    nivel: 1,
    novaPagina: true,
    compacto: true,
    corpo: `A unidade ANA Nilópolis está localizada na região Leste de Campinas e atua em um território marcado por contrastes sociais e desafios relacionados à desigualdade e vulnerabilidade social.
Por meio do Serviço de Convivência e Fortalecimento de Vínculos (SCFV), a unidade desenvolve atividades socioeducativas voltadas para crianças e adolescentes de 6 a 14 anos, promovendo convivência, desenvolvimento de habilidades e fortalecimento dos vínculos familiares e comunitários.
Unidade: ANA Nilópolis
Responsável técnico:`,
  },
  {
    id: 'ana-2',
    titulo: "ANA II",
    nivel: 1,
    novaPagina: false,
    compacto: true,
    corpo: `A unidade ANA DIC está localizada na região Sudoeste de Campinas, uma das áreas mais populosas do município e que apresenta índices elevados de vulnerabilidade social e famílias em situação de pobreza.
Além das atividades do Serviço de Convivência e Fortalecimento de Vínculos, a unidade também desenvolve o Centro de Convivência Inclusivo e Intergeracional (CCII), ampliando o atendimento para diferentes ciclos de vida e promovendo espaços de convivência, inclusão social e fortalecimento da comunidade.
Unidade: ANA Dic
Responsável técnico:`,
  },
  {
    id: 'ana-3',
    titulo: "ANA III",
    nivel: 1,
    novaPagina: false,
    compacto: true,
    corpo: `A unidade ANA Santana, localizada na região Leste de Campinas, atua em um território com importantes desafios sociais relacionados à desigualdade e à vulnerabilidade de famílias.
Por meio de oficinas e atividades socioeducativas do Serviço de Convivência e Fortalecimento de Vínculos (SCFV), a unidade promove espaços de convivência, aprendizagem e desenvolvimento para crianças e adolescentes, contribuindo para o fortalecimento de vínculos familiares e comunitários.
Unidade: ANA Santana
Responsável técnico:`,
  },
  {
    id: 'ana-piaui',
    titulo: "ANA PIAUÍ",
    nivel: 1,
    novaPagina: false,
    compacto: true,
    corpo: `A unidade ANA Piauí, localizada no município de São Raimundo Nonato, atua em um território marcado por importantes desafios socioeconômicos e pela busca constante por oportunidades de desenvolvimento humano.
Por meio de oficinas e atividades socioeducativas do Serviço de Convivência e Fortalecimento de Vínculos (SCFV), a unidade promove espaços de acolhimento, aprendizagem e cidadania para crianças e adolescentes. O trabalho foca no desenvolvimento de potencialidades locais e no fortalecimento dos vínculos familiares e comunitários, essenciais para a transformação social da região.
Unidade: ANA Piauí
Responsável técnico:`,
  },
  {
    id: 'ccii',
    titulo: "CCII - CENTRO CONVIVÊNCIA INCLUSIVO E INTERGERACIONAL",
    nivel: 1,
    novaPagina: true,
    corpo: `O Centro Convivência Inclusivo e Intergeracional (CCII) integra a Proteção Social Básica do Sistema Único de Assistência Social (SUAS) e constitui-se como espaço público de referência para o desenvolvimento de ações socioassistenciais que promovam convivência, fortalecimento de vínculos, inclusão social e participação cidadã.
O serviço está fundamentado na Política Nacional de Assistência Social – PNAS (2004) e regulamentado pela Tipificação Nacional de Serviços Socioassistenciais (Resolução CNAS nº 109/2009). O CCII organiza-se como equipamento que oferta atividades intergeracionais e inclusivas, atuando de maneira preventiva e protetiva frente a situações de vulnerabilidade, risco social e isolamento.
Sua proposta central é proporcionar condições para que pessoas de diferentes faixas etárias — crianças, adolescentes, jovens, adultos, idosos e pessoas com deficiência — tenham acesso a experiências coletivas, fortalecendo vínculos familiares e comunitários, ampliando repertórios e desenvolvendo autonomia, habilidades sociais e competências relacionais.
Objetivos do Serviço
- Fortalecer vínculos familiares e comunitários por meio de atividades que promovam convivência, inclusão e participação social;
- Prevenir situações de isolamento, negligência, discriminação e rompimento de vínculos;
- Favorecer o acesso dos usuários à rede socioassistencial e aos demais serviços públicos do território;
- Estimular a autonomia, a autoestima, o protagonismo e o exercício da cidadania;
- Desenvolver ações que valorizem a diversidade geracional e promovam a troca de saberes, culturas e experiências;
- Contribuir para a garantia de direitos e para a proteção social dos usuários atendidos.`,
  },
  {
    id: 'justificativa',
    titulo: "JUSTIFICATIVA",
    nivel: 1,
    novaPagina: true,
    corpo: `A justificativa para a proposta, “{tema}”, no âmbito do SCFV se dá diante das situações de vulnerabilidade e risco social vivenciadas por crianças, adolescentes, jovens, adultos, idosos e famílias em territórios marcados por fragilidade de vínculos afetivos, ausência de acesso a políticas públicas, pobreza, desigualdades, e discriminações. A proposta precisa estar alinhada à Tipificação Nacional dos Serviços Socioassistenciais, instituída pela Resolução nº 109, de 11 de novembro de 2009, do Conselho Nacional de Assistência Social (CNAS). Segundo a Tipificação, o SCFV é ofertado de forma complementar ao trabalho social com famílias, realizado no âmbito do PAIF (Proteção e Atendimento Integral à Família) e tem por objetivo, prevenir situações de risco social, fortalecer vínculos familiares e comunitários, promover o desenvolvimento de potencialidades, talentos e habilidades dos usuários, de acordo com seu ciclo etário de vida. Parte do reconhecimento de que a convivência familiar e comunitária é um direito fundamental e um fator essencial para o desenvolvimento humano e social. Com a proposta busca-se então, criar espaços de convivência, de reconhecimento de identidades, de valorização de histórias de vida e de construção coletiva, promovendo a socialização e a formação cidadã dos participantes.`,
  },
  {
    id: 'objetivo-geral',
    titulo: "OBJETIVO GERAL",
    nivel: 2,
    novaPagina: false,
    corpo: `Promover o desenvolvimento pessoal, social e emocional dos participantes por meio de atividades, que estimulem a convivência, o protagonismo, o respeito e a construção de valores e projetos de vida.`,
  },
  {
    id: 'objetivos-especificos',
    titulo: "OBJETIVOS ESPECÍFICOS (PENSAR EM CADA OFICINA DESENVOLVIDA)",
    nivel: 2,
    novaPagina: false,
    corpo: `- Fortalecer os vínculos familiares e comunitários;
- Promover a convivência grupal e o sentimento de pertencimento;
- Estimular a expressão de sentimentos, sonhos e potencialidades;
- Desenvolver habilidades sociais, afetivas e cognitivas;
- Incentivar atitudes de solidariedade, empatia e respeito;
- Oferecer espaços de escuta, diálogo e acolhimento.
- Estimular a reflexão sobre a identidade pessoal e o pertencimento ao meio social;
- Incentivar ações de cidadania e responsabilidade socioambiental;
- Trabalhar a valorização da diversidade, a igualdade de direitos e a cultura de paz.
- Desenvolver estratégias para estimular as potencialidades de crianças com deficiência e o papel das famílias e comunidade no processo de proteção social;`,
  },
  {
    id: 'metodologia',
    titulo: "METODOLOGIA",
    nivel: 1,
    novaPagina: true,
    compacto: true,
    corpo: `As oficinas serão desenvolvidas de forma coletiva, participativa, lúdica e reflexiva, com metodologias adequadas, respeitando faixa etária e à realidade do público atendido.Contemplando os cunhos culturais, artesanais, recreativos, esportivos e socioeducativos, contribuindo para o desenvolvimento de integral dos participantes, assegurando sempre a função protetiva da assistência social e o direito à convivência digna e igualitária. Durante o período de referência, os meses serão organizados por temas transversais.`,
  },
  {
    id: 'avaliacao',
    titulo: "AVALIAÇÃO",
    nivel: 2,
    novaPagina: false,
    compacto: true,
    corpo: `Acontecerá de forma contínua, através de observação, dos participantes, frequência nas atividades, Identificando os avanços e dificuldades no desenvolvimento das atividades. registros diários das oficinas em instrumentais. Apresentação pública dos resultados (exposições , feiras culturais, eventos, apresentações, murais, entre outros).`,
  },
];

/** O corpo de uma seção: o que as coordenadoras escreveram, ou o de 2026. */
export function corpoDaSecao(textos: Record<string, string> | null | undefined, id: string): string {
  const escrito = textos?.[id];
  if (typeof escrito === 'string') return escrito;
  return SECOES_DO_TEXTO.find(s => s.id === id)?.corpo ?? '';
}

/* ---------- unidades novas (13/11/2026) ---------- */
// Em 2027 o Social pode ganhar unidades. Cada uma é acrescentada por um botão
// e vira a próxima na ordem (ANA IV, ANA V…), depois da ANA III e antes da
// ANA PIAUÍ. O texto é delas: a unidade nova existe enquanto a chave
// "ana-N" estiver nos textos, mesmo vazia.

const ULTIMA_DA_BASE = 3;

const ROMANOS: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function romano(n: number): string {
  let r = '';
  for (const [v, s] of ROMANOS) while (n >= v) { r += s; n -= v; }
  return r;
}

/** Os números das unidades novas que existem nos textos (4, 5…), em ordem. */
export function unidadesNovas(textos: Record<string, string> | null | undefined): number[] {
  return Object.keys(textos ?? {})
    .map(k => /^ana-(\d+)$/.exec(k)?.[1])
    .map(Number)
    .filter(n => Number.isInteger(n) && n > ULTIMA_DA_BASE && typeof textos?.[`ana-${n}`] === 'string')
    .sort((a, b) => a - b);
}

export const secaoDaUnidadeNova = (n: number): SecaoDoTexto => ({ id: `ana-${n}`, titulo: `ANA ${romano(n)}`, nivel: 1, novaPagina: false, compacto: true, corpo: '' });

/** As seções do ano: as de 2026 com as unidades novas depois da ANA III. */
export function secoesDoAno(textos: Record<string, string> | null | undefined, novas = unidadesNovas(textos)): SecaoDoTexto[] {
  const depois = SECOES_DO_TEXTO.findIndex(s => s.id === `ana-${ULTIMA_DA_BASE}`) + 1;
  return [...SECOES_DO_TEXTO.slice(0, depois), ...novas.map(secaoDaUnidadeNova), ...SECOES_DO_TEXTO.slice(depois)];
}

/** A próxima unidade nova: 4 se não há nenhuma, senão a seguinte à última. */
export const proximaUnidade = (novas: number[]) => (novas.length ? novas[novas.length - 1] + 1 : ULTIMA_DA_BASE + 1);
