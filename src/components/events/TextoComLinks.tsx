import { Fragment } from 'react';

/**
 * Um texto em que os endereços de site viram links, e só eles.
 *
 * A descrição do evento respeitava as quebras de linha, mas um endereço de
 * inscrição ou de mapa colado nela aparecia como texto morto. Aqui, o que
 * começa com `http://`, `https://` ou `www.` vira um link em nova aba; todo o
 * resto continua texto, renderizado pelo React — nenhum HTML da descrição é
 * interpretado. Decisão de 10/09/2026: vale no detalhe, não no card.
 */
const ENDERECO = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

/** Pontuação que costuma fechar a frase e não faz parte do endereço. */
const tiraPontuacaoFinal = (url: string): [string, string] => {
  const m = url.match(/[.,;:!?)\]]+$/);
  return m ? [url.slice(0, -m[0].length), m[0]] : [url, ''];
};

const hrefDe = (url: string): string => (url.toLowerCase().startsWith('www.') ? `https://${url}` : url);

interface Props {
  texto: string;
}

export function TextoComLinks({ texto }: Props) {
  const partes = texto.split(ENDERECO);
  return (
    <>
      {partes.map((parte, i) => {
        // o split com grupo de captura intercala texto (par) e endereço (ímpar)
        if (i % 2 === 0) return <Fragment key={i}>{parte}</Fragment>;
        const [url, sobra] = tiraPontuacaoFinal(parte);
        return (
          <Fragment key={i}>
            <a
              href={hrefDe(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 break-all hover:opacity-80"
            >
              {url}
            </a>
            {sobra}
          </Fragment>
        );
      })}
    </>
  );
}

export default TextoComLinks;
