import { describe, expect, it } from 'vitest';
import {
  avisoDeTransbordo,
  calcularTransbordo,
  RESPIRO_INFERIOR,
  type PecaMedida,
} from './transbordo';

/**
 * A conta que impede o corte silencioso.
 *
 * O caso que motivou este arquivo: medir pela altura da GRADE conclui que tudo
 * cabe, porque a grade cresce junto com o conteúdo. Por isso a função recebe a
 * altura **visível**, e o teste abaixo fixa essa distinção.
 */

const pecas = (...pares: [number, number][]): PecaMedida[] =>
  pares.map(([topo, altura]) => ({ topo, altura }));

describe('calcular o transbordo', () => {
  it('não acusa nada quando tudo cabe', () => {
    const r = calcularTransbordo(pecas([24, 100], [136, 200]), 999);

    expect(r.transborda).toBe(false);
    expect(r.primeiraFora).toBe(-1);
    expect(r.sobra).toBe(0);
    expect(r.pecasFora).toBe(0);
  });

  it('desconta o respiro inferior da folha', () => {
    expect(calcularTransbordo(pecas([0, 999]), 999).limite).toBe(999 - RESPIRO_INFERIOR);
  });

  /** A peça que encosta exatamente no limite ainda cabe. */
  it('trata o limite como inclusivo', () => {
    const limite = 999 - RESPIRO_INFERIOR;
    expect(calcularTransbordo(pecas([0, limite]), 999).transborda).toBe(false);
    expect(calcularTransbordo(pecas([0, limite + 1]), 999).transborda).toBe(true);
  });

  it('aponta a primeira peça fora e conta quantas sobraram', () => {
    // limite = 975
    const r = calcularTransbordo(pecas([24, 400], [436, 500], [948, 200], [1160, 150]), 999);

    expect(r.transborda).toBe(true);
    expect(r.primeiraFora).toBe(2);
    expect(r.pecasFora).toBe(2);
  });

  it('mede a sobra pela peça que vai mais fundo, não pela última da lista', () => {
    // Duas peças dividindo a última fileira: a alta vem antes na ordem do DOM,
    // a baixa depois. Olhar só a última subestimaria a perda.
    const r = calcularTransbordo(pecas([24, 100], [136, 1200], [136, 50]), 999);

    expect(r.sobra).toBe(1336 - (999 - RESPIRO_INFERIOR));
  });

  /**
   * O caso real que me enganou: a grade cresceu para 1290 e eu media por ela.
   * Com a altura da grade, a conta diz que cabe; com a altura visível, não.
   */
  it('a altura da grade crescida esconderia o transbordo', () => {
    // A grade cresce até caber o conteúdo: com o último bloco terminando em
    // 1266, ela mede 1290 (1266 + respiro). Perguntar a ela é perguntar a
    // alguém que já se ajustou ao problema — e a resposta é sempre "cabe".
    const conteudo = pecas([24, 400], [436, 500], [948, 318]);

    expect(calcularTransbordo(conteudo, 1290).transborda).toBe(false); // medida errada
    expect(calcularTransbordo(conteudo, 999).transborda).toBe(true); // medida certa
  });

  it('lida com folha vazia e com altura inválida sem quebrar', () => {
    expect(calcularTransbordo([], 999).transborda).toBe(false);
    expect(calcularTransbordo(pecas([0, 10]), 0).limite).toBe(0);
    expect(calcularTransbordo(pecas([0, 10]), -50).limite).toBe(0);
  });
});

describe('o aviso que a diretora lê', () => {
  it('cala quando cabe', () => {
    expect(avisoDeTransbordo(calcularTransbordo(pecas([24, 100]), 999))).toBeNull();
    expect(avisoDeTransbordo(null)).toBeNull();
  });

  it('usa singular para uma peça e plural para várias', () => {
    const uma = avisoDeTransbordo(calcularTransbordo(pecas([24, 1200]), 999));
    expect(uma).toContain('Uma peça');

    const varias = avisoDeTransbordo(calcularTransbordo(pecas([24, 1200], [1240, 100]), 999));
    expect(varias).toContain('2 peças');
  });

  /** Ela precisa saber a consequência, não a medida. */
  it('fala de sumir no PDF, e não de pixels', () => {
    const aviso = avisoDeTransbordo(calcularTransbordo(pecas([24, 1200]), 999)) ?? '';
    expect(aviso).toContain('PDF');
    expect(aviso).not.toContain('px');
  });
});
