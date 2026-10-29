import { ENDERECO_DA_UNIDADE } from '@/lib/events/local';

/**
 * Fábrica de Artes (PR 1, 29/10/2026): as artes da ANA saem de padrões
 * aprovados, sem IA. A gestora responde como a arte vai ser usada, o que ela
 * conta e para quem é; o motor (`motor.ts`) escolhe a família por pontos; o
 * molde (`components/artes/moldes.ts`) desenha a prévia no navegador.
 *
 * As 9 famílias vieram da leitura das 21 artes aprovadas até 29/10/2026
 * (mockup https://claude.ai/artifact/UtPc9WXrC1YMb2cGbYU43t). Neste PR, 7
 * têm molde; Ficha e Adesivo/tag ficam só anunciadas.
 */
export type Uso = 'digital' | 'impressa' | 'os_dois';
export type Conta = 'evento' | 'dias' | 'regras' | 'placa' | 'doacao' | 'ficha' | 'adesivo';
export type Publico = 'familias' | 'criancas' | 'mulheres' | 'idosos' | 'jovens' | 'equipe' | 'empresas';
export type Publica = 'grupo' | 'story' | 'feed';
export type Familia = 'convite' | 'infantil' | 'cronograma' | 'convocacao' | 'cartaz' | 'placa' | 'campanha' | 'ficha' | 'adesivo';
export type Formato = '4x5' | 'story' | 'a4r' | 'a4p' | 'a3r' | 'a6x4' | 'adesivo';

export const ROTULO: Record<Conta | Publico | Uso, string> = {
  evento: 'um evento com dia e hora', dias: 'vários dias ou atividades', regras: 'regras para a parede', placa: 'uma frase por placa',
  doacao: 'pedido de doação', ficha: 'ficha para preencher', adesivo: 'adesivo ou etiqueta',
  familias: 'famílias e comunidade', criancas: 'crianças', mulheres: 'mulheres', idosos: 'pessoas idosas', jovens: 'adolescentes e jovens',
  equipe: 'equipe', empresas: 'empresas e parceiros',
  digital: 'só digital', impressa: 'impressa', os_dois: 'os dois',
};

export const OPCOES_DE_CONTA: ReadonlyArray<{ chave: Conta; rotulo: string; exemplo: string }> = [
  { chave: 'evento', rotulo: 'Um evento com dia e hora', exemplo: 'palestra, reunião, almoço, encontro' },
  { chave: 'dias', rotulo: 'Vários dias ou atividades', exemplo: 'programação da semana, cronograma' },
  { chave: 'regras', rotulo: 'Regras ou combinados para a parede', exemplo: 'lista numerada numa folha só' },
  { chave: 'placa', rotulo: 'Uma frase por placa', exemplo: 'série de placas: refeitório, banheiro, sala' },
  { chave: 'doacao', rotulo: 'Pedido de doação ou itens', exemplo: 'lista de necessidades para parceiros' },
  { chave: 'ficha', rotulo: 'Ficha para preencher à mão', exemplo: 'atendimento, controle' },
  { chave: 'adesivo', rotulo: 'Adesivo ou etiqueta de produto', exemplo: 'oficinas, tags' },
];
export const OPCOES_DE_PUBLICO: ReadonlyArray<{ chave: Publico; rotulo: string }> = [
  { chave: 'familias', rotulo: 'Famílias e comunidade' }, { chave: 'criancas', rotulo: 'Crianças' }, { chave: 'mulheres', rotulo: 'Mulheres' },
  { chave: 'idosos', rotulo: 'Pessoas idosas' }, { chave: 'jovens', rotulo: 'Adolescentes e jovens' }, { chave: 'equipe', rotulo: 'Equipe (funcionários)' },
  { chave: 'empresas', rotulo: 'Empresas e parceiros' },
];

/** As unidades que pedem arte: a tag do logo, o setor (decide o rodapé e a paleta) e o endereço. */
export interface UnidadeDaArte { chave: string; nome: string; cheio: string; setor: 'social' | 'educacao'; endereco: string }
export const UNIDADES_DA_ARTE: readonly UnidadeDaArte[] = [
  { chave: 'dic', nome: 'Dic', cheio: 'Unidade DIC', setor: 'social', endereco: ENDERECO_DA_UNIDADE['DIC'] ?? '' },
  { chave: 'nilopolis', nome: 'Nilópolis', cheio: 'ANA Nilópolis', setor: 'social', endereco: ENDERECO_DA_UNIDADE['Nilópolis'] ?? '' },
  { chave: 'santana', nome: 'Santana', cheio: 'ANA Santana', setor: 'social', endereco: ENDERECO_DA_UNIDADE['Santana'] ?? '' },
  { chave: 'saodomingos', nome: 'São Domingos', cheio: 'ANA São Domingos', setor: 'social', endereco: 'Campinas-SP' },
  { chave: 'ccii', nome: 'CCII', cheio: 'CCII', setor: 'social', endereco: 'Campinas-SP' },
  { chave: 'bemquerer', nome: 'Bem Querer', cheio: 'CEI Bem Querer', setor: 'educacao', endereco: 'Campinas-SP' },
  { chave: 'trilhando', nome: 'Trilhando', cheio: 'Trilhando Futuro', setor: 'educacao', endereco: 'Campinas-SP' },
  { chave: 'geral', nome: '', cheio: 'ANA Brasil', setor: 'social', endereco: 'Campinas-SP' },
];
export const unidadeDaArte = (chave: string | null | undefined) => UNIDADES_DA_ARTE.find(u => u.chave === chave) ?? UNIDADES_DA_ARTE[UNIDADES_DA_ARTE.length - 1];

export interface Familia_ { nome: string; desc: string; formatos: Formato[]; campos: string[]; emBreve?: boolean }
export const FAMILIAS: Record<Familia, Familia_> = {
  convite: { nome: 'Convite de evento', desc: 'Foto no topo terminando em onda de duas faixas, título em dois tamanhos, Data · Horário · Local, faixa de inscrição e logo da unidade. O molde da Menopausa, do Encontro e da Reunião.', formatos: ['4x5', 'story', 'a4r'], campos: ['foto', 'pre', 't1', 't2', 'apoio', 'palestrante', 'data', 'hora', 'local'] },
  infantil: { nome: 'Convite infantil', desc: 'Foto que some em gradiente, título Fredoka colorido com contorno branco, fita azul, atrações com bolinhas e cards-adesivo. O molde do Dia das Crianças e da Semana Maluca.', formatos: ['4x5', 'story', 'a4p'], campos: ['foto', 't2', 'fita', 'atracoes', 'data', 'hora', 'local'] },
  cronograma: { nome: 'Cronograma', desc: 'Foto com onda de uma faixa, pílula da unidade, título com marca-texto e a grade de dias com ícone, etiqueta e descrição. O molde da Semana da Infância.', formatos: ['4x5', 'a4r'], campos: ['foto', 't1', 't2', 'apoio', 'itens'] },
  convocacao: { nome: 'Convocação interna', desc: 'Logo branco com a tag do setor sobre a foto da equipe, bloco verde-água com título gigante e ponto coral, faixa amarela de chamada e rodapé grafite com Data · Horário · Local.', formatos: ['4x5'], campos: ['foto', 'ante', 't1', 't2', 'chamada', 'data', 'hora', 'local'] },
  cartaz: { nome: 'Cartaz de regras', desc: 'Foto com gradiente escuro, título grande, lista numerada em duas colunas com numerais na cor da paleta e faixa de fecho grafite. O molde dos Combinados e das Regras do Trilhando.', formatos: ['a4r', 'a3r'], campos: ['foto', 'pre', 't2', 'regras', 'fecho'] },
  placa: { nome: 'Placa de ambiente', desc: 'Fundo verde-água, painel branco, ícone em círculo e uma frase só em caixa alta, com o logo com tagline. Coral só na placa de aviso. O molde das Placas do Refeitório.', formatos: ['a4p', 'a4r'], campos: ['placas'] },
  campanha: { nome: 'Campanha de doação', desc: 'Foto com camada grafite vindo da esquerda, título branco com palavra-chave em bloco verde-água, blocos de lista em três cores e pílula de contato. O molde do Trilhando.', formatos: ['4x5', 'story', 'a4r'], campos: ['foto', 'pre', 't2', 'apoio', 'grupos'] },
  ficha: { nome: 'Ficha para preencher', desc: 'Documento para escrever à mão: cabeçalho creme, campos com linha, opções com caixa de marcar; sai 4 por folha com marcas de corte e versão PB. O molde da Ficha de Atendimento CCII.', formatos: ['a6x4'], campos: ['t2', 'campos'], emBreve: true },
  adesivo: { nome: 'Adesivo e tag', desc: 'Adesivo redondo 50 mm e tag 50×85 mm com furo, moldura na cor da família e frase central. Sai em folha de 15 e 9 por A4 ou em pacote para gráfica. O molde da Oficina de Costura.', formatos: ['adesivo'], campos: ['t2', 'frase'], emBreve: true },
};

export const FORMATOS: Record<Formato, { nome: string; w: number; h: number; saida: string }> = {
  '4x5': { nome: 'Feed 4:5', w: 1080, h: 1350, saida: 'JPEG 3240×4050' },
  story: { nome: 'Story 9:16', w: 1080, h: 1920, saida: 'JPEG 2160×3840' },
  a4r: { nome: 'A4 em pé', w: 1080, h: 1527, saida: 'PDF A4 + JPEG 2480×3508' },
  a4p: { nome: 'A4 deitado', w: 1527, h: 1080, saida: 'PDF A4 + JPEG 3508×2480' },
  a3r: { nome: 'A3 em pé', w: 1080, h: 1527, saida: 'PDF A3 + JPEG 3508×4961' },
  a6x4: { nome: 'A6 · 4 por folha', w: 1080, h: 1527, saida: 'PDF A4 com 4 fichas e marcas de corte' },
  adesivo: { nome: 'Adesivo + tag', w: 1080, h: 1080, saida: 'PDF 15 e 9 por A4 · pacote gráfica' },
};

/** Os campos que a gestora preenche, por chave; cada família lista os seus. */
export type TipoDeCampo = 'foto' | 'text' | 'apoio' | 'date' | 'lista' | 'lista2';
export interface Campo { t: TipoDeCampo; r: string; ex?: string | [string, string]; max?: number }
export const CAMPOS: Record<string, Campo> = {
  foto: { t: 'foto', r: 'Foto do topo' },
  pre: { t: 'text', r: 'Linha de cima (categoria)', ex: 'Em parceria com o Projeto MM · CONVITE ÀS FAMÍLIAS', max: 40 },
  t1: { t: 'text', r: 'Título · linha menor', ex: 'Vamos falar sobre', max: 26 },
  t2: { t: 'text', r: 'Título · palavra grande', ex: 'Menopausa', max: 18 },
  apoio: { t: 'apoio', r: 'Frase de apoio', ex: 'Uma tarde de conversa, acolhimento e informação entre mulheres.', max: 120 },
  palestrante: { t: 'text', r: 'Palestrante (opcional)', ex: 'Helga', max: 30 },
  data: { t: 'date', r: 'Data' },
  hora: { t: 'text', r: 'Horário', ex: '14h · Palestra e conversa', max: 28 },
  local: { t: 'text', r: 'Local', ex: 'preenchido pela unidade', max: 60 },
  fita: { t: 'text', r: 'Slogan da fita azul', ex: 'Loucos por Jesus!', max: 24 },
  atracoes: { t: 'lista', r: 'Atrações (até 6)', ex: 'Pula-pula', max: 6 },
  ante: { t: 'text', r: 'Quem é convocado', ex: 'EDUCADORES E EQUIPE TÉCNICA', max: 40 },
  chamada: { t: 'text', r: 'Chamada da faixa amarela', ex: 'Contamos com a sua presença!', max: 40 },
  itens: { t: 'lista2', r: 'Dias ou atividades (2 a 8)', ex: ['19 · SEG', 'Dia do brinquedo: traga o seu brinquedo preferido'], max: 8 },
  regras: { t: 'lista2', r: 'Combinados (4 a 10)', ex: ['Respeito', 'Ouvir o educador e os colegas'], max: 10 },
  fecho: { t: 'text', r: 'Frase de fecho', ex: 'Juntos, a gente voa mais alto.', max: 50 },
  grupos: { t: 'lista2', r: 'Grupos de itens (até 3)', ex: ['Material escolar', '20 cadernos · 50 lápis · 10 mochilas'], max: 3 },
  placas: { t: 'lista2', r: 'Placas da série (uma frase cada, até 2 linhas)', ex: ['Higienize as mãos antes de comer', 'maos'], max: 13 },
  campos: { t: 'lista', r: 'Campos da ficha', ex: 'Nome', max: 10 },
  frase: { t: 'text', r: 'Frase do adesivo', ex: 'Feito à mão, com carinho', max: 40 },
};

/** Tudo que a gestora respondeu e preencheu. */
export interface Pedido {
  uso: Uso | null;
  plastificar: 'sim' | 'nao' | null;
  copias: number | null;
  publica: Publica[];
  conta: Conta | null;
  publico: Publico | null;
  unidade: string;
  parceiro: string;
  telefone: string;
  familia: Familia | null;
  formato: Formato | null;
  dados: Record<string, string | string[] | [string, string][]>;
}
export const PEDIDO_VAZIO: Pedido = { uso: null, plastificar: null, copias: null, publica: [], conta: null, publico: null, unidade: '', parceiro: '', telefone: '', familia: null, formato: null, dados: {} };

export const texto = (p: Pedido, k: string): string => { const v = p.dados[k]; return typeof v === 'string' ? v : '' };
export const lista = (p: Pedido, k: string): string[] => { const v = p.dados[k]; return Array.isArray(v) && (v.length === 0 || typeof v[0] === 'string') ? (v as string[]) : [] };
export const pares = (p: Pedido, k: string): [string, string][] => { const v = p.dados[k]; return Array.isArray(v) && v.length > 0 && Array.isArray(v[0]) ? (v as [string, string][]) : [] };
/** Quantos dias/placas a arte tem: decide A4 deitado e a série de placas. */
export const quantosDias = (p: Pedido) => Math.max(pares(p, 'itens').length, lista(p, 'atracoes').length);
export const quantasPlacas = (p: Pedido) => Math.max(1, pares(p, 'placas').filter(x => x[0]).length);
