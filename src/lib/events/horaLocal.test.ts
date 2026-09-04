import { describe, expect, it } from 'vitest';
import { paraCampoDataHora, rotuloDoFuso } from './horaLocal';

/**
 * A ida (banco → campo) e a volta (campo → banco) precisam se anular.
 *
 * O teste não fixa fuso: roda no relógio da máquina, como o formulário. Se a
 * ida usasse UTC de novo, a volta daria uma data diferente em qualquer fuso
 * que não seja GMT — e o teste cairia aqui, em Brasília, onde a regressão
 * apareceu.
 */
describe('paraCampoDataHora', () => {
  it('abrir e salvar sem mexer devolve a mesma data', () => {
    const gravado = '2025-07-31T11:00:00.000Z';

    const noCampo = paraCampoDataHora(gravado);
    const salvo = new Date(noCampo).toISOString();

    expect(salvo).toBe(gravado);
  });

  it('o campo mostra a hora local, não a UTC', () => {
    const d = new Date('2025-07-31T11:00:00.000Z');
    const esperado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    expect(paraCampoDataHora(d.toISOString())).toBe(esperado);
  });

  it.each([null, undefined, '', 'não é data'])('devolve vazio para %s', (valor) => {
    expect(paraCampoDataHora(valor)).toBe('');
  });
});

describe('rotuloDoFuso', () => {
  it('escreve o deslocamento como GMT±h', () => {
    const rotulo = rotuloDoFuso(new Date('2025-07-31T12:00:00Z'));
    expect(rotulo).toMatch(/^GMT([+−]\d{1,2}(:\d{2})?)?$/);
  });
});
