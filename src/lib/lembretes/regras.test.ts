import { describe, expect, it } from 'vitest';
import {
  CORES, LEGENDA_DO_COMO_ENVIAR, MENSAGEM_PADRAO, MODELO_PADRAO, corDoComoEnviar, corDoDia, ehDiaDoLembrete, hojeEmBrasilia, pecasDoDia, proximoLembrete, semanaDoAno,
} from '../../../supabase/functions/lembrete-registros/regras';

/** O lembrete diário dos registros (24/11/2026): seg–sex às 10h, 5 cores, "Como enviar" às segundas. */
describe('o lembrete dos registros', () => {
  it('cada dia útil tem a sua cor; fim de semana não tem', () => {
    // 22/11/2026 é domingo; 23/11, segunda… 28/11, sábado.
    expect(['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'].map(corDoDia))
      .toEqual([null, 'azul', 'amarelo', 'coral', 'verde', 'areia', null]);
    expect(ehDiaDoLembrete('2026-11-28')).toBe(false);
    expect(ehDiaDoLembrete('2026-11-30')).toBe(true);
  });

  it('as peças: arte com a mensagem, o modelo separado e, só às segundas, o "Como enviar"', () => {
    const terca = pecasDoDia('2026-11-24', MENSAGEM_PADRAO, MODELO_PADRAO);
    expect(terca).toEqual([
      { tipo: 'imagem', arquivo: 'registros-amarelo.jpg', legenda: MENSAGEM_PADRAO },
      { tipo: 'texto', texto: MODELO_PADRAO },
    ]);
    const segunda = pecasDoDia('2026-11-30', MENSAGEM_PADRAO, MODELO_PADRAO);
    expect(segunda).toHaveLength(3);
    expect(segunda[0]).toMatchObject({ arquivo: 'registros-azul.jpg' });
    expect(segunda[2]).toEqual({ tipo: 'imagem', arquivo: `como-enviar-${corDoComoEnviar('2026-11-30')}.jpg`, legenda: LEGENDA_DO_COMO_ENVIAR });
    expect(pecasDoDia('2026-11-29', MENSAGEM_PADRAO, MODELO_PADRAO)).toEqual([]);
    // Sem modelo, só a arte.
    expect(pecasDoDia('2026-11-25', 'Oi', '  ')).toHaveLength(1);
  });

  it('o "Como enviar" troca de cor a cada semana e passa pelas 5', () => {
    const segundas = ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'];
    const cores = segundas.map(corDoComoEnviar);
    expect(new Set(cores).size).toBe(5);
    expect(cores.every(c => CORES.includes(c))).toBe(true);
    expect(semanaDoAno('2026-12-31')).toBe(53);
    expect(semanaDoAno('2027-01-04')).toBe(1);
  });

  it('o próximo envio: hoje antes das 10h; depois, o próximo dia útil; o fim de semana pula para segunda', () => {
    expect(proximoLembrete(new Date('2026-11-24T12:59:00Z'))).toBe('2026-11-24'); // terça 9h59 em Brasília
    expect(proximoLembrete(new Date('2026-11-24T13:01:00Z'))).toBe('2026-11-25'); // terça 10h01
    expect(proximoLembrete(new Date('2026-11-27T14:00:00Z'))).toBe('2026-11-30'); // sexta 11h → segunda
    expect(proximoLembrete(new Date('2026-11-29T12:00:00Z'))).toBe('2026-11-30'); // domingo
    expect(hojeEmBrasilia(new Date('2026-11-25T02:00:00Z'))).toBe('2026-11-24'); // 23h de terça em Brasília
  });

  it('a mensagem de fábrica é a do material dele, com o modelo dentro', () => {
    expect(MENSAGEM_PADRAO).toMatch(/^⚠️ \*LEMBRETE\*/);
    expect(MENSAGEM_PADRAO).toContain('📅 *Data:*');
    expect(MODELO_PADRAO.split('\n')).toHaveLength(3);
  });
});
