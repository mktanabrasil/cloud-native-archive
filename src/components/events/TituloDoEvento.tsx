import { Fragment } from 'react';

/**
 * O título do evento, com a quebra de linha que a pessoa escreve como `<br>`.
 *
 * Antes o título era entregue ao navegador como HTML cru
 * (`dangerouslySetInnerHTML`), para que esse `<br>` funcionasse. O preço era
 * alto: **tudo** que fosse escrito no campo virava HTML. Um título como
 * `<img src=x onerror="…">` executava JavaScript no navegador de todo visitante
 * anônimo da página pública — reproduzi o caminho exato de renderização em
 * 02/09/2026 e o código rodou.
 *
 * Aqui o texto é texto: o React escapa tudo. Só o marcador `<br>` vira quebra
 * de verdade, porque é o único que este componente reconhece. Qualquer outra
 * marcação aparece como o que é — as letras que a pessoa digitou — e não faz
 * nada.
 */

interface Props {
  texto: string;
  /**
   * A quebra vale só a partir de `md`.
   *
   * No banner público um título de duas linhas no desktop vira uma torre no
   * celular, onde a largura já quebra sozinha. No preview do formulário, que é
   * pequeno e fixo, a quebra vale sempre.
   */
  apenasNoDesktop?: boolean;
}

/** `<br>`, `<br/>` e `<br />`, em qualquer caixa. */
const MARCADOR_DE_QUEBRA = /<br\s*\/?>/i;

export function TituloDoEvento({ texto, apenasNoDesktop = false }: Props) {
  const partes = texto.split(MARCADOR_DE_QUEBRA);

  return (
    <>
      {partes.map((parte, i) => (
        <Fragment key={i}>
          {i > 0 &&
            (apenasNoDesktop ? (
              <span className="hidden md:inline">
                <br />
              </span>
            ) : (
              <br />
            ))}
          {parte}
        </Fragment>
      ))}
    </>
  );
}

export default TituloDoEvento;
