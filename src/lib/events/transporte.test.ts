import { describe, expect, it } from 'vitest';
import { FROTA, TETO_DA_FROTA, apoiosPossiveis, errosDeTransporte, motivoDoApoio, resumoDoTransporte, sugerirTransporte, totalDePessoas } from './transporte';

describe('a frota', () => {
  it('os assentos incluem o motorista: lugares para passageiros são um a menos', () => {
    expect(FROTA.map(v => [v.label, v.assentos, v.lugares])).toEqual([
      ['VAN', 15, 14],
      ['Kombi', 12, 11],
      ['Utilitário/Caminhão', 2, 1],
    ]);
  });
});

describe('totalDePessoas', () => {
  it('soma a vaga do marketing só quando a cobertura foi pedida', () => {
    expect(totalDePessoas({ transport_passengers: 8, marketing_request: true, marketing_coverage: true }).total).toBe(9);
    expect(totalDePessoas({ transport_passengers: 8, marketing_request: true, marketing_coverage: false }).total).toBe(8);
    expect(totalDePessoas({ transport_passengers: 8, marketing_request: false, marketing_coverage: true }).total).toBe(8);
  });

  it('com o não do marketing, a vaga sai; a confirmar, fica reservada', () => {
    expect(totalDePessoas({ transport_passengers: 8, marketing_request: true, marketing_coverage: true, marketing_confirmed: false }).total).toBe(8);
    expect(totalDePessoas({ transport_passengers: 8, marketing_request: true, marketing_coverage: true, marketing_confirmed: null }).total).toBe(9);
  });
});

describe('sugerirTransporte', () => {
  it('o menor que cabe: 8 → Kombi, 12 → VAN, 14 → VAN lotada', () => {
    expect(sugerirTransporte(8)!.texto).toBe('Kombi');
    expect(sugerirTransporte(11)!.texto).toBe('Kombi');
    expect(sugerirTransporte(12)!.principal.label).toBe('VAN');
    expect(sugerirTransporte(14)!.apoio).toBeNull();
  });

  it('acima da VAN: VAN + o menor apoio que cabe o resto', () => {
    const s = sugerirTransporte(18)!;
    expect(s.principal.label).toBe('VAN');
    expect(s.apoio!.label).toBe('Kombi');
    expect(s.sobra).toBe(4);
    expect(s.texto).toBe('VAN + Kombi de apoio');
  });

  it('nunca repete veículo: há uma VAN e uma Kombi', () => {
    // Em produção, com 25, apareceu "VAN + VAN de apoio".
    expect(TETO_DA_FROTA).toBe(25);
    const s = sugerirTransporte(25)!;
    expect(s.texto).toBe('VAN + Kombi de apoio');
    expect(s.apoio!.value).not.toBe(s.principal.value);
  });

  it('acima do teto não há veículo a sugerir', () => {
    expect(sugerirTransporte(26)).toBeNull();
    expect(sugerirTransporte(45)).toBeNull();
  });

  it('volumosos somam o utilitário', () => {
    expect(sugerirTransporte(8, true)!.texto).toBe('Kombi + utilitário');
  });

  it('zero pessoas, nada a sugerir', () => {
    expect(sugerirTransporte(0)).toBeNull();
  });
});

describe('resumoDoTransporte', () => {
  it('desligado não tem resumo', () => {
    expect(resumoDoTransporte({ transport_needed: false, transport_vehicle: 'van', transport_passengers: 5 })).toBeNull();
  });

  it('13 + cobertura lota a VAN (14 lugares), sem exceder', () => {
    const r = resumoDoTransporte({ transport_needed: true, transport_vehicle: 'van', transport_passengers: 13, marketing_request: true, marketing_coverage: true })!;
    expect(r.total).toBe(14);
    expect(r.lotado).toBe(true);
    expect(r.excedido).toBe(false);
    expect(r.texto).toBe('VAN 14/14 · 13 + 1 marketing');
    expect(motivoDoApoio(r)).toMatch(/sem folga/i);
  });

  it('14 + cobertura excede a VAN; com Kombi de apoio, fecha', () => {
    const sem = resumoDoTransporte({ transport_needed: true, transport_vehicle: 'van', transport_passengers: 14, marketing_request: true, marketing_coverage: true })!;
    expect(sem.excedido).toBe(true);
    expect(motivoDoApoio(sem)).toBe('Faltam 1 lugar — escolha um veículo de apoio, ou um maior.');

    const com = resumoDoTransporte({ ...{ transport_needed: true, transport_vehicle: 'van', transport_passengers: 17, marketing_request: true, marketing_coverage: true }, transport_support_vehicle: 'kombi', transport_extra_equipment: true })!;
    expect(com.excedido).toBe(false);
    expect(com.texto).toBe('VAN 14/14 + Kombi 4/11 · 17 + 1 marketing · leva volumosos');
  });

  it('acima do teto: avisa quanto falta e pede a equipe de apoio; com o interruptor, o detalhe registra', () => {
    const r = resumoDoTransporte({ transport_needed: true, transport_vehicle: 'van', transport_support_vehicle: 'kombi', transport_passengers: 27, marketing_request: true, marketing_coverage: true })!;
    expect(r.acimaDoTeto).toBe(true);
    expect(r.faltamNaFrota).toBe(3);
    expect(r.motoristas).toBe(2);
    expect(r.sugestao).toBeNull();
    expect(motivoDoApoio(r)).toBe('Não cabe na frota da ANA: VAN + Kombi levam 25, faltam 3. Acione a equipe de apoio para transporte.');
    expect(r.texto).toBe('VAN 14/14 + Kombi 11/11 · 27 + 1 marketing · faltam 3 na frota');

    const marcado = resumoDoTransporte({ transport_needed: true, transport_vehicle: 'van', transport_support_vehicle: 'kombi', transport_passengers: 28, transport_external_support: true })!;
    expect(marcado.texto).toBe('VAN 14/14 + Kombi 11/11 · 28 pessoas · faltam 3 — apoio externo');
  });

  it('o apoio só oferece o que sobrou da frota', () => {
    expect(apoiosPossiveis('van').map(v => v.value)).toEqual(['kombi', 'utilitario']);
    expect(apoiosPossiveis('').map(v => v.value)).toEqual(['van', 'kombi', 'utilitario']);
  });

  it('sem veículo escolhido, o texto diz que falta definir', () => {
    expect(resumoDoTransporte({ transport_needed: true, transport_vehicle: '', transport_passengers: 4 })!.texto).toBe('Veículo a definir · 4 pessoas');
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

  it('não cabe no veículo escolhido e sem apoio: cobra o apoio', () => {
    const r = errosDeTransporte({ transport_needed: true, transport_vehicle: 'kombi', transport_passengers: 12 });
    expect(r.transport_support_vehicle).toMatch(/não cabem 12 no kombi/i);
  });

  it('apoio igual ao principal é erro: só há um de cada', () => {
    const r = errosDeTransporte({ transport_needed: true, transport_vehicle: 'van', transport_support_vehicle: 'van', transport_passengers: 20 });
    expect(r.transport_support_vehicle).toMatch(/outro veículo/i);
  });

  it('acima do teto NÃO é erro: só avisa, o envio segue', () => {
    expect(errosDeTransporte({ transport_needed: true, transport_vehicle: 'van', transport_support_vehicle: 'kombi', transport_passengers: 40 })).toEqual({});
  });

  it('completo e cabendo, passa', () => {
    expect(errosDeTransporte({ transport_needed: true, transport_vehicle: 'van', transport_passengers: 3 })).toEqual({});
  });
});
