import { TRANSPORT_VEHICLES, type AppEvent, type TransportVehicle } from '@/types';

/**
 * A conta do transporte, num lugar só.
 *
 * O formulário fazia a conta na tela e não guardava a parte que mais importa
 * para quem organiza: "leva equipamentos volumosos" morria ao salvar. Também
 * deixava passar transporte ligado sem veículo. Aqui a mesma conta serve ao
 * formulário e aos painéis de detalhe.
 *
 * Regra fechada em 04/09/2026: os **assentos** da frota incluem o motorista.
 * Lugares para passageiros = assentos − 1: VAN 14, Kombi 11, Utilitário 1.
 * Antes o total de passageiros era comparado com os assentos cheios — a VAN
 * aparecia com 15 lugares para gente.
 *
 * E o veículo é **sugerido** pela lotação: a pessoa diz quantos vão, a tela
 * propõe o menor que cabe. Acima da VAN, VAN + o menor apoio que cabe o
 * resto. Volumosos pedem o utilitário, que é para carga.
 */

type CamposDeTransporte = Pick<
  AppEvent,
  | 'transport_needed' | 'transport_vehicle' | 'transport_support_vehicle' | 'transport_passengers'
  | 'transport_extra_equipment' | 'marketing_request' | 'marketing_coverage'
>;

export interface Veiculo {
  value: TransportVehicle;
  label: string;
  assentos: number;
  /** Assentos menos o motorista. */
  lugares: number;
  /** Utilitário: carga, não gente. */
  carga: boolean;
}

export const FROTA: Veiculo[] = TRANSPORT_VEHICLES.map(v => ({
  value: v.value,
  label: v.label,
  assentos: v.capacity,
  lugares: Math.max(0, v.capacity - 1),
  carga: v.value === 'utilitario',
}));

export const veiculo = (value: TransportVehicle | '' | null | undefined): Veiculo | null =>
  FROTA.find(v => v.value === value) ?? null;

/** Quantos vão, contando a vaga do marketing quando a cobertura foi pedida. */
export function totalDePessoas(e: Partial<CamposDeTransporte>): { passageiros: number; vagaMarketing: number; total: number } {
  const passageiros = Number(e.transport_passengers) || 0;
  const vagaMarketing = e.marketing_request && e.marketing_coverage ? 1 : 0;
  return { passageiros, vagaMarketing, total: passageiros + vagaMarketing };
}

export interface Sugestao {
  principal: Veiculo;
  /** Quando o principal não basta: o menor que cabe o resto. */
  apoio: Veiculo | null;
  /** Quantas pessoas ficam para o apoio. */
  sobra: number;
  /** Volumosos: utilitário além dos veículos de gente. */
  utilitario: boolean;
  /** "Kombi", "VAN + Kombi de apoio", "VAN + Kombi de apoio + utilitário" */
  texto: string;
}

const DE_GENTE = FROTA.filter(v => !v.carga).sort((a, b) => a.lugares - b.lugares);
const MAIOR = DE_GENTE[DE_GENTE.length - 1];
const UTILITARIO = FROTA.find(v => v.carga) ?? null;

/** O menor veículo que cabe `total`; acima do maior, maior + apoio. `null` com zero pessoas. */
export function sugerirTransporte(total: number, volumosos = false): Sugestao | null {
  if (total <= 0) return null;
  const cabe = DE_GENTE.find(v => v.lugares >= total);
  const principal = cabe ?? MAIOR;
  const sobra = cabe ? 0 : total - MAIOR.lugares;
  const apoio = sobra > 0 ? (DE_GENTE.find(v => v.lugares >= sobra) ?? MAIOR) : null;
  const utilitario = volumosos && !!UTILITARIO;
  const partes = [principal.label];
  if (apoio) partes.push(`${apoio.label} de apoio`);
  if (utilitario) partes.push('utilitário');
  return { principal, apoio, sobra, utilitario, texto: partes.join(' + ') };
}

export interface ResumoDoTransporte {
  veiculo: Veiculo | null;
  apoio: Veiculo | null;
  passageiros: number;
  vagaMarketing: number;
  total: number;
  /** Lugares para passageiros somando principal e apoio. */
  lugares: number;
  lotado: boolean;
  excedido: boolean;
  volumosos: boolean;
  sugestao: Sugestao | null;
  /** "VAN 14/14 + Kombi 4/11 · 17 + 1 marketing · leva volumosos" */
  texto: string;
}

export function resumoDoTransporte(e: Partial<CamposDeTransporte>): ResumoDoTransporte | null {
  if (!e.transport_needed) return null;
  const v = veiculo(e.transport_vehicle);
  const apoio = veiculo(e.transport_support_vehicle);
  const { passageiros, vagaMarketing, total } = totalDePessoas(e);
  const volumosos = !!e.transport_extra_equipment;
  const lugares = (v?.lugares ?? 0) + (apoio?.lugares ?? 0);
  const lotado = lugares > 0 && total >= lugares;
  const excedido = lugares > 0 && total > lugares;

  const partes: string[] = [];
  if (v) {
    const noPrincipal = Math.min(total, v.lugares);
    partes.push(`${v.label} ${noPrincipal}/${v.lugares}${apoio ? ` + ${apoio.label} ${Math.max(0, total - v.lugares)}/${apoio.lugares}` : ''}`);
  } else {
    partes.push('Veículo a definir');
  }
  if (total > 0) partes.push(vagaMarketing ? `${passageiros} + 1 marketing` : `${total} ${total === 1 ? 'pessoa' : 'pessoas'}`);
  if (volumosos) partes.push('leva volumosos');

  return {
    veiculo: v, apoio, passageiros, vagaMarketing, total, lugares, lotado, excedido, volumosos,
    sugestao: sugerirTransporte(total, volumosos),
    texto: partes.join(' · '),
  };
}

/** Por que a escolha atual não fecha — ou `null`. */
export function motivoDoApoio(r: ResumoDoTransporte): string | null {
  if (r.excedido) {
    const faltam = r.total - r.lugares;
    return `Faltam ${faltam} ${faltam === 1 ? 'lugar' : 'lugares'} — escolha um veículo de apoio, ou um maior.`;
  }
  if (r.lotado && r.volumosos) return 'Lotado e com volumosos — o utilitário vai junto.';
  if (r.lotado) return 'Sem folga: se mais alguém for, precisa de veículo de apoio.';
  if (r.volumosos) return 'Volumosos vão no utilitário, além do veículo das pessoas.';
  return null;
}

/** O que falta quando o transporte está ligado. Vazio quando desligado ou completo. */
export function errosDeTransporte(
  e: Partial<CamposDeTransporte>,
): Partial<Record<'transport_vehicle' | 'transport_passengers' | 'transport_support_vehicle', string>> {
  if (!e.transport_needed) return {};
  const erros: Partial<Record<'transport_vehicle' | 'transport_passengers' | 'transport_support_vehicle', string>> = {};
  const { total } = totalDePessoas(e);
  if (!(Number(e.transport_passengers) > 0)) erros.transport_passengers = 'Informe quantas pessoas vão';
  if (!e.transport_vehicle) {
    erros.transport_vehicle = 'Escolha o veículo, ou desligue o transporte';
    return erros;
  }
  const r = resumoDoTransporte(e);
  if (r && r.excedido) {
    erros.transport_support_vehicle = `Não cabem ${total} no ${r.veiculo?.label ?? 'veículo'}${r.apoio ? ` + ${r.apoio.label}` : ''}: escolha um apoio, ou um veículo maior`;
  }
  return erros;
}
