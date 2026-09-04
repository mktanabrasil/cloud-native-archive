import { describe, expect, it } from 'vitest';
import { errosDeTransporte, motivoDoApoio, resumoDoTransporte } from './transporte';

describe('resumoDoTransporte', () => {
  it('desligado não tem resumo', () => {
    expect(resumoDoTransporte({ transport_needed: false, transport_vehicle: 'van', transport_passengers: 5 })).toBeNull();
  });

  it('conta a vaga do marketing e diz quando lota', () => {
    const r = resumoDoTransporte({
      transport_needed: true, transport_vehicle: 'van', transport_passengers: 14,
      marketing_request: true, marketing_coverage: true, transport_extra_equipment: true,
    })!;
    expect(r.ocupados).toBe(15);
    expect(r.lotado).toBe(true);
    expect(r.excedido).toBe(false);
    expect(r.precisaApoio).toBe(true);
    expect(r.texto).toBe('VAN · 15/15 assentos (14 + 1 marketing) · leva volumosos');
    expect(motivoDoApoio(r)).toBe('Lotado e com volumosos — contabilize um veículo de apoio.');
  });

  it('sem cobertura, sem vaga extra; folga não pede apoio', () => {
    const r = resumoDoTransporte({ transport_needed: true, transport_vehicle: 'kombi', transport_passengers: 6, marketing_request: true, marketing_coverage: false })!;
    expect(r.vagaMarketing).toBe(0);
    expect(r.texto).toBe('Kombi · 6/12 assentos');
    expect(motivoDoApoio(r)).toBeNull();
  });

  it('excedido é mais grave que lotado', () => {
    const r = resumoDoTransporte({ transport_needed: true, transport_vehicle: 'utilitario', transport_passengers: 3 })!;
    expect(r.excedido).toBe(true);
    expect(motivoDoApoio(r)).toMatch(/excedidos/);
  });

  it('sem veículo escolhido, o texto diz que falta definir', () => {
    const r = resumoDoTransporte({ transport_needed: true, transport_vehicle: '', transport_passengers: 4 })!;
    expect(r.texto).toBe('Veículo a definir · 4 pessoas');
  });
});

describe('errosDeTransporte', () => {
  it('desligado, nada a cobrar', () => {
    expect(errosDeTransporte({ transport_needed: false })).toEqual({});
  });

  it('ligado sem veículo e com zero pessoas cobra os dois', () => {
    expect(errosDeTransporte({ transport_needed: true, transport_vehicle: '', transport_passengers: 0 })).toEqual({
      transport_vehicle: 'Escolha o veículo, ou desligue o transporte',
      transport_passengers: 'Informe quantas pessoas vão',
    });
  });

  it('completo passa', () => {
    expect(errosDeTransporte({ transport_needed: true, transport_vehicle: 'van', transport_passengers: 3 })).toEqual({});
  });
});
