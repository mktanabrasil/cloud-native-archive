import { TRANSPORT_VEHICLES, type AppEvent } from '@/types';

/**
 * A conta do transporte, num lugar só.
 *
 * O formulário fazia a conta na tela (assentos, vaga do marketing, aviso de
 * veículo de apoio) e não guardava a parte que mais importa para quem
 * organiza: "leva equipamentos volumosos" era estado do componente e morria
 * ao salvar. Também deixava passar transporte ligado sem veículo e com zero
 * passageiros. Aqui a mesma conta serve ao formulário e aos dois painéis de
 * detalhe, e a validação diz o que falta.
 */

type CamposDeTransporte = Pick<
  AppEvent,
  'transport_needed' | 'transport_vehicle' | 'transport_passengers' | 'transport_extra_equipment' | 'marketing_request' | 'marketing_coverage'
>;

export interface ResumoDoTransporte {
  veiculo: string | null;
  capacidade: number;
  passageiros: number;
  /** 1 quando a cobertura de marketing foi pedida: alguém do marketing vai junto. */
  vagaMarketing: number;
  ocupados: number;
  lotado: boolean;
  excedido: boolean;
  volumosos: boolean;
  precisaApoio: boolean;
  /** "VAN · 15/15 assentos (14 + 1 marketing) · leva volumosos" */
  texto: string;
}

export function resumoDoTransporte(e: Partial<CamposDeTransporte>): ResumoDoTransporte | null {
  if (!e.transport_needed) return null;
  const veiculo = TRANSPORT_VEHICLES.find(v => v.value === e.transport_vehicle) ?? null;
  const capacidade = veiculo?.capacity ?? 0;
  const passageiros = Number(e.transport_passengers) || 0;
  const vagaMarketing = e.marketing_request && e.marketing_coverage ? 1 : 0;
  const ocupados = passageiros + vagaMarketing;
  const lotado = capacidade > 0 && ocupados >= capacidade;
  const excedido = capacidade > 0 && ocupados > capacidade;
  const volumosos = !!e.transport_extra_equipment;

  const partes: string[] = [veiculo?.label ?? 'Veículo a definir'];
  if (capacidade > 0) {
    partes.push(`${ocupados}/${capacidade} assentos${vagaMarketing ? ` (${passageiros} + 1 marketing)` : ''}`);
  } else if (ocupados > 0) {
    partes.push(`${ocupados} ${ocupados === 1 ? 'pessoa' : 'pessoas'}`);
  }
  if (volumosos) partes.push('leva volumosos');

  return {
    veiculo: veiculo?.label ?? null,
    capacidade,
    passageiros,
    vagaMarketing,
    ocupados,
    lotado,
    excedido,
    volumosos,
    precisaApoio: lotado || volumosos,
    texto: partes.join(' · '),
  };
}

/** Por que precisa de veículo de apoio — ou `null`. */
export function motivoDoApoio(r: ResumoDoTransporte): string | null {
  if (r.excedido) return 'Assentos excedidos — contabilize um veículo de apoio.';
  if (r.lotado && r.volumosos) return 'Lotado e com volumosos — contabilize um veículo de apoio.';
  if (r.lotado) return 'Todos os assentos estão ocupados — contabilize um veículo de apoio.';
  if (r.volumosos) return 'Transporte de equipamentos — contabilize um veículo de apoio.';
  return null;
}

/** O que falta quando o transporte está ligado. Vazio quando desligado ou completo. */
export function errosDeTransporte(e: Partial<CamposDeTransporte>): Partial<Record<'transport_vehicle' | 'transport_passengers', string>> {
  if (!e.transport_needed) return {};
  const erros: Partial<Record<'transport_vehicle' | 'transport_passengers', string>> = {};
  if (!e.transport_vehicle) erros.transport_vehicle = 'Escolha o veículo, ou desligue o transporte';
  if (!(Number(e.transport_passengers) > 0)) erros.transport_passengers = 'Informe quantas pessoas vão';
  return erros;
}
