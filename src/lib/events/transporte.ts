import { TRANSPORT_VEHICLES, type AppEvent, type TransportVehicle } from '@/types';

/**
 * A conta do transporte, num lugar só.
 *
 * O formulário fazia a conta na tela e não guardava a parte que mais importa
 * para quem organiza: "leva equipamentos volumosos" morria ao salvar. Também
 * deixava passar transporte ligado sem veículo. Aqui a mesma conta serve ao
 * formulário e aos painéis de detalhe.
 *
 * Regras fechadas em 04/09/2026:
 *  - os **assentos** da frota incluem o motorista; lugares para passageiros =
 *    assentos − 1: VAN 14, Kombi 11, Utilitário 1;
 *  - a frota é **uma unidade de cada**. A sugestão nunca repete veículo (em
 *    produção chegou a aparecer "VAN + VAN de apoio"), e o apoio nunca é o
 *    mesmo que o principal;
 *  - o **teto** é o que VAN + Kombi carregam: 25. Acima disso não há veículo a
 *    sugerir — a tela avisa quanto falta e pede para acionar a equipe de apoio
 *    (fretado, segunda viagem, carona de parceiro). Só avisa: o envio segue.
 */

type CamposDeTransporte = Pick<
  AppEvent,
  | 'transport_needed' | 'transport_vehicle' | 'transport_support_vehicle' | 'transport_passengers'
  | 'transport_extra_equipment' | 'transport_external_support' | 'marketing_request' | 'marketing_coverage'
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

const DE_GENTE = FROTA.filter(v => !v.carga).sort((a, b) => a.lugares - b.lugares);
const UTILITARIO = FROTA.find(v => v.carga) ?? null;

/** Quantos passageiros a frota inteira carrega de uma vez: VAN + Kombi = 25. */
export const TETO_DA_FROTA = DE_GENTE.reduce((s, v) => s + v.lugares, 0);

export const veiculo = (value: TransportVehicle | '' | null | undefined): Veiculo | null =>
  FROTA.find(v => v.value === value) ?? null;

/** O que pode ser apoio dado o principal: a frota menos ele. */
export const apoiosPossiveis = (principal: TransportVehicle | '' | null | undefined): Veiculo[] =>
  FROTA.filter(v => v.value !== principal);

/** Quantos vão, contando a vaga do marketing quando a cobertura foi pedida. */
export function totalDePessoas(e: Partial<CamposDeTransporte>): { passageiros: number; vagaMarketing: number; total: number } {
  const passageiros = Number(e.transport_passengers) || 0;
  const vagaMarketing = e.marketing_request && e.marketing_coverage ? 1 : 0;
  return { passageiros, vagaMarketing, total: passageiros + vagaMarketing };
}

export interface Sugestao {
  principal: Veiculo;
  /** Quando o principal não basta: o menor **outro** veículo que cabe o resto. */
  apoio: Veiculo | null;
  /** Quantas pessoas ficam para o apoio. */
  sobra: number;
  /** Volumosos: utilitário além dos veículos de gente. */
  utilitario: boolean;
  /** "Kombi", "VAN + Kombi de apoio", "VAN + Kombi de apoio + utilitário" */
  texto: string;
}

/**
 * O menor veículo que cabe `total`; acima do maior, maior + o menor outro
 * que cabe o resto. `null` com zero pessoas **ou acima do teto** — aí não há
 * veículo a sugerir, há gente a acionar.
 */
export function sugerirTransporte(total: number, volumosos = false): Sugestao | null {
  if (total <= 0 || total > TETO_DA_FROTA) return null;
  const cabe = DE_GENTE.find(v => v.lugares >= total);
  const principal = cabe ?? DE_GENTE[DE_GENTE.length - 1];
  const sobra = cabe ? 0 : total - principal.lugares;
  const apoio = sobra > 0 ? (DE_GENTE.filter(v => v.value !== principal.value).find(v => v.lugares >= sobra) ?? null) : null;
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
  /** Um por veículo usado. */
  motoristas: number;
  lotado: boolean;
  excedido: boolean;
  volumosos: boolean;
  /** Passou do que VAN + Kombi carregam. */
  acimaDoTeto: boolean;
  /** Quantos não cabem na frota inteira (0 se cabe). */
  faltamNaFrota: number;
  /** A pessoa marcou que vai acionar apoio de fora. */
  apoioExterno: boolean;
  sugestao: Sugestao | null;
  /** "VAN 14/14 + Kombi 11/11 · 27 + 1 marketing · faltam 3 — apoio externo" */
  texto: string;
}

export function resumoDoTransporte(e: Partial<CamposDeTransporte>): ResumoDoTransporte | null {
  if (!e.transport_needed) return null;
  const v = veiculo(e.transport_vehicle);
  const apoio = veiculo(e.transport_support_vehicle);
  const { passageiros, vagaMarketing, total } = totalDePessoas(e);
  const volumosos = !!e.transport_extra_equipment;
  const apoioExterno = !!e.transport_external_support;
  const lugares = (v?.lugares ?? 0) + (apoio?.lugares ?? 0);
  const motoristas = (v ? 1 : 0) + (apoio ? 1 : 0);
  const lotado = lugares > 0 && total >= lugares;
  const excedido = lugares > 0 && total > lugares;
  const acimaDoTeto = total > TETO_DA_FROTA;
  const faltamNaFrota = Math.max(0, total - TETO_DA_FROTA);

  const partes: string[] = [];
  if (v) {
    const noPrincipal = Math.min(total, v.lugares);
    partes.push(`${v.label} ${noPrincipal}/${v.lugares}${apoio ? ` + ${apoio.label} ${Math.min(apoio.lugares, Math.max(0, total - v.lugares))}/${apoio.lugares}` : ''}`);
  } else {
    partes.push('Veículo a definir');
  }
  if (total > 0) partes.push(vagaMarketing ? `${passageiros} + 1 marketing` : `${total} ${total === 1 ? 'pessoa' : 'pessoas'}`);
  if (acimaDoTeto) partes.push(`faltam ${faltamNaFrota}${apoioExterno ? ' — apoio externo' : ' na frota'}`);
  else if (apoioExterno) partes.push('apoio externo');
  if (volumosos) partes.push('leva volumosos');

  return {
    veiculo: v, apoio, passageiros, vagaMarketing, total, lugares, motoristas, lotado, excedido, volumosos,
    acimaDoTeto, faltamNaFrota, apoioExterno,
    sugestao: sugerirTransporte(total, volumosos),
    texto: partes.join(' · '),
  };
}

/** Por que a escolha atual não fecha — ou `null`. */
export function motivoDoApoio(r: ResumoDoTransporte): string | null {
  if (r.acimaDoTeto) {
    return `Não cabe na frota da ANA: VAN + Kombi levam ${TETO_DA_FROTA}, faltam ${r.faltamNaFrota}. Acione a equipe de apoio para transporte.`;
  }
  if (r.excedido) {
    const faltam = r.total - r.lugares;
    return `Faltam ${faltam} ${faltam === 1 ? 'lugar' : 'lugares'} — escolha um veículo de apoio, ou um maior.`;
  }
  if (r.lotado && r.volumosos) return 'Lotado e com volumosos — o utilitário vai junto.';
  if (r.lotado) return 'Sem folga: se mais alguém for, precisa de veículo de apoio.';
  if (r.volumosos) return 'Volumosos vão no utilitário, além do veículo das pessoas.';
  return null;
}

type ErrosDeTransporte = Partial<Record<'transport_vehicle' | 'transport_passengers' | 'transport_support_vehicle', string>>;

/**
 * O que falta quando o transporte está ligado. Vazio quando desligado ou
 * completo. Acima do teto **não é erro**: o evento acontece e o fretado é
 * decisão de quem aprova — a tela avisa, o envio segue.
 */
export function errosDeTransporte(e: Partial<CamposDeTransporte>): ErrosDeTransporte {
  if (!e.transport_needed) return {};
  const erros: ErrosDeTransporte = {};
  const { total } = totalDePessoas(e);
  if (!(Number(e.transport_passengers) > 0)) erros.transport_passengers = 'Informe quantas pessoas vão';
  if (!e.transport_vehicle) {
    erros.transport_vehicle = 'Escolha o veículo, ou desligue o transporte';
    return erros;
  }
  if (e.transport_support_vehicle && e.transport_support_vehicle === e.transport_vehicle) {
    erros.transport_support_vehicle = 'O apoio precisa ser outro veículo: só há um de cada';
    return erros;
  }
  const r = resumoDoTransporte(e);
  if (r && r.excedido && !r.acimaDoTeto) {
    erros.transport_support_vehicle = `Não cabem ${total} no ${r.veiculo?.label ?? 'veículo'}${r.apoio ? ` + ${r.apoio.label}` : ''}: escolha um apoio, ou um veículo maior`;
  }
  return erros;
}
