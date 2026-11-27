import type { AreaDeAjuda } from './modelo';

/**
 * Os 15 ambientes do Recanto Maanaim (27/11/2026), na aba Local da Central.
 * Sem foto de drone para uma planta: cada ambiente tem as fotos e o que
 * acontece nele, como nos slides do treinamento ("Os ambientes", 01 a 15),
 * com a Recreação do documento de 27/11 (oficinas no quiosque, gincanas na
 * quadra). As fotos ficam em public/central-maanaim: NN-1p.webp é a capa
 * (16:9, 640 px) e NN-kg.webp são as grandes (1280 px).
 */
export interface Ambiente {
  n: number;
  nome: string;
  oQue: readonly string[];
  nota?: string;
  /** Quantas fotos grandes há (NN-1g … NN-kg). */
  fotos: number;
}

export const AMBIENTES: readonly Ambiente[] = [
  { n: 1, nome: 'Ginásio', oQue: ['Culto das crianças', 'Encerramento e entrega de presentes', 'Árvore dos presentes'], nota: 'Culto com o Kids do Nazareno, para crianças de até 10 anos (cerca de 484).', fotos: 3 },
  { n: 2, nome: 'Campo de futebol', oQue: ['Brinquedos infláveis', 'Gincanas'], fotos: 3 },
  { n: 3, nome: 'Quadra externa', oQue: ['Gincanas', 'Recreação'], fotos: 3 },
  { n: 4, nome: 'Parquinho', oQue: ['Recreação'], nota: 'Liberado para utilização.', fotos: 2 },
  { n: 5, nome: 'Quiosque de madeira', oQue: ['Estações', 'Oficinas'], fotos: 3 },
  { n: 6, nome: 'Pátio coberto', oQue: ['Atendimento aos idosos', 'Manicure, bingo e mais'], nota: 'Ao lado do campo de areia.', fotos: 3 },
  { n: 7, nome: 'Mirante com mesas', oQue: ['Árvore de Natal do Nilópolis'], nota: 'Do lado esquerdo, em frente à lanchonete.', fotos: 3 },
  { n: 8, nome: 'Capela', oQue: ['Culto dos adolescentes', 'Show de talentos do CCII'], nota: 'Com o Nazateen, para cerca de 250 adolescentes.', fotos: 3 },
  { n: 9, nome: 'Refeitório', oQue: ['Refeições gerais', 'Mesa do cardápio'], nota: 'Cadeiras para 282 pessoas. A mesa do cardápio fica no fundo.', fotos: 3 },
  { n: 10, nome: 'Auditório da Cruz', oQue: ['Culto dos idosos', 'Alojamento dos idosos'], nota: 'Em frente ao auditório, mesas e cadeiras para os idosos.', fotos: 3 },
  { n: 11, nome: 'Cozinha', oQue: ['Preparo das refeições'], fotos: 2 },
  { n: 12, nome: 'Churrasqueira', oQue: ['Oficinas'], fotos: 3 },
  { n: 13, nome: 'Chalés', oQue: ['Organização de mochilas', 'Troca de roupas'], nota: 'Dormitórios perto da casinha, no estacionamento. Unidades DIC e Ekballo.', fotos: 2 },
  { n: 14, nome: 'Alojamento', oQue: ['Organização de mochilas', 'Troca de roupas'], nota: 'Santana em cima, Nilópolis embaixo.', fotos: 2 },
  { n: 15, nome: 'Campo de areia', oQue: ['Recreação'], fotos: 2 },
];

const dois = (n: number) => String(n).padStart(2, '0');
export const capaDoAmbiente = (a: Ambiente) => `/central-maanaim/${dois(a.n)}-1p.webp`;
export const fotosDoAmbiente = (a: Ambiente) => Array.from({ length: a.fotos }, (_, i) => `/central-maanaim/${dois(a.n)}-${i + 1}g.webp`);

/** Onde cada área trabalha no dia (1ª opção). Crianças atípicas acompanham as crianças em todo lugar. */
export const AMBIENTES_DA_AREA: Partial<Record<AreaDeAjuda, readonly number[]>> = {
  cozinha: [11, 9],
  inflaveis: [2],
  estacoes: [5, 6],
  ccii: [6, 10, 8],
  recreacao_kids: [3, 2, 5, 15, 4],
  louvor_kids: [1],
  som: [1, 8],
  presentes_kids: [1],
};

export const ambientesDaArea = (area: string | null | undefined): Ambiente[] =>
  (AMBIENTES_DA_AREA[area as AreaDeAjuda] ?? []).map((n) => AMBIENTES.find((a) => a.n === n)!).filter(Boolean);
