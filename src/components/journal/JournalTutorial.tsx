import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { PERCURSOS, type PassoTutorial, type PercursoId } from '@/lib/journal/tutorial';

interface Props {
  /**
   * O roteiro. Os do Jornal vêm de `PERCURSOS`; outro roteiro (o do
   * Calendário Anual, 13/11/2026) manda os próprios `passos`.
   */
  percurso: string;
  passos?: PassoTutorial[];
  /** O nome do diálogo para o leitor de tela. */
  rotulo?: string;
  aberto: boolean;
  onFechar: () => void;
  /**
   * Concluir, pular e Esc valem o mesmo: ela viu o que quis ver. Quem guarda
   * a marca é quem abriu (o `useTutoriaisVistos` da página), por conta.
   */
  onVisto?: (percurso: string) => void;
}

/** Distância entre o holofote e a borda do elemento apontado. */
const FOLGA = 8;
/** Espaço que o cartão precisa para não encostar na borda da janela. */
const MARGEM = 12;
/** A barra fixa do topo do app: o alvo rolado para a vista fica abaixo dela. */
const TOPO_LIVRE = 96;

interface Caixa {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * O tutorial do Jornal: um holofote sobre o controle e um cartão explicando.
 *
 * Ele aponta para elementos reais, achados por `data-tutorial`. Quando o alvo
 * não está na tela — no celular as colunas viram abas, e a coluna apontada
 * pode estar escondida —, o cartão aparece **centralizado, sem holofote**, em
 * vez de apontar para o nada. O passo continua sendo lido; só perde o dedo.
 */
export function JournalTutorial({ percurso, passos: passosDeFora, rotulo, aberto, onFechar, onVisto }: Props) {
  const passos = passosDeFora ?? PERCURSOS[percurso as PercursoId] ?? [];
  const [indice, setIndice] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);

  useEffect(() => {
    if (aberto) setIndice(0);
  }, [aberto, percurso]);

  const passo = passos[indice];

  /** Mede o alvo. Refaz a cada passo, e quando a janela mexe. */
  const medir = useCallback(() => {
    if (!aberto || !passo) return;
    const alvo = document.querySelector<HTMLElement>(`[data-tutorial="${passo.alvo}"]`);
    if (!alvo) {
      setCaixa(null);
      return;
    }
    const r = alvo.getBoundingClientRect();
    // Elemento existe mas está colapsado (aba fechada no celular): trata como ausente.
    if (r.width < 4 || r.height < 4) {
      setCaixa(null);
      return;
    }
    setCaixa({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [aberto, passo]);

  useLayoutEffect(() => {
    medir();
  }, [medir]);

  // O alvo fora da tela (17/11/2026, Semanário): rola até ele a cada passo.
  // Sem isto, um alvo mais abaixo deixava o cartão abaixo da borda da tela, e
  // no celular ele simplesmente não aparecia. O alvo alto (uma lista inteira)
  // fica com o começo à vista, abaixo da barra do topo; a rolagem dispara o
  // `medir` pelo ouvinte de scroll.
  useEffect(() => {
    if (!aberto || !passo) return;
    const alvo = document.querySelector<HTMLElement>(`[data-tutorial="${passo.alvo}"]`);
    if (!alvo) return;
    const r = alvo.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    if (r.top >= TOPO_LIVRE && r.bottom <= window.innerHeight - MARGEM) return;
    const alto = r.height > (window.innerHeight - TOPO_LIVRE) * 0.6;
    const antes = alvo.style.scrollMarginTop;
    alvo.style.scrollMarginTop = `${TOPO_LIVRE}px`;
    alvo.scrollIntoView?.({ block: alto ? 'start' : 'center', behavior: 'smooth' });
    alvo.style.scrollMarginTop = antes;
  }, [aberto, passo]);

  useEffect(() => {
    if (!aberto) return;
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [aberto, medir]);

  const encerrar = useCallback(() => {
    // Concluir e pular valem o mesmo: ela viu o que quis ver. Reabrir sozinho
    // depois de ela ter dispensado seria insistência, não ajuda.
    onVisto?.(percurso);
    onFechar();
  }, [onFechar, onVisto, percurso]);

  const seguir = useCallback(() => {
    if (indice >= passos.length - 1) encerrar();
    else setIndice((i) => i + 1);
  }, [encerrar, indice, passos.length]);

  useEffect(() => {
    if (!aberto) return;
    const teclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') encerrar();
      else if (evento.key === 'ArrowRight') seguir();
      else if (evento.key === 'ArrowLeft') setIndice((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', teclado);
    return () => window.removeEventListener('keydown', teclado);
  }, [aberto, encerrar, seguir]);

  // A altura real do cartão (no celular, um texto comprido passa de 200 px).
  const cartaoRef = useRef<HTMLDivElement>(null);
  const [alturaDoCartao, setAlturaDoCartao] = useState(200);
  useLayoutEffect(() => {
    const h = cartaoRef.current?.offsetHeight;
    if (h && Math.abs(h - alturaDoCartao) > 2) setAlturaDoCartao(h);
  }, [alturaDoCartao, indice, aberto]);

  if (!aberto || !passo) return null;

  /* Posição do cartão: abaixo do alvo; se não couber, acima; se o alvo for
     alto demais para os dois (uma lista inteira), no pé da tela, por cima do
     fim dele, para o começo continuar à vista. Nunca fora da tela. */
  const LARGURA_CARTAO = 320;
  let estiloCartao: React.CSSProperties;

  if (caixa) {
    const debaixo = caixa.top + caixa.height + FOLGA + 6;
    const emCima = caixa.top - FOLGA - 6 - alturaDoCartao;
    const topo = debaixo + alturaDoCartao <= window.innerHeight - MARGEM ? debaixo
      : emCima >= MARGEM ? emCima
      : Math.max(MARGEM, window.innerHeight - alturaDoCartao - MARGEM);
    const esquerda = Math.min(
      Math.max(MARGEM, caixa.left),
      Math.max(MARGEM, window.innerWidth - LARGURA_CARTAO - MARGEM),
    );
    estiloCartao = { top: topo, left: esquerda };
  } else {
    estiloCartao = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const ultimo = indice === passos.length - 1;

  return createPortal(
    // Sem o vidro do V2 (13/11/2026): `body.ui-v2 [role="dialog"]` pinta toda
    // janela de branco translúcido com desfoque, e esta camada é a tela
    // inteira. Desde 26/10 o holofote mostrava um borrão branco no lugar do
    // botão, no Jornal também. O estilo na própria camada vence a regra.
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={rotulo ?? 'Tutorial do Jornal'}
      style={{ background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none', boxShadow: 'none', border: 0, borderRadius: 0 }}>
      {/* O escurecimento com buraco: a sombra gigante cobre a tela inteira e o
          retângulo em si fica limpo, sem precisar de máscara nem de SVG.
          Sem transição de propósito — animar `top`/`left` faz o holofote entrar
          voando do canto da tela no primeiro passo. */}
      {caixa ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-[14px] ring-2 ring-[hsl(var(--sel,168_80%_27%))]"
          style={{
            top: caixa.top - FOLGA,
            left: caixa.left - FOLGA,
            width: caixa.width + FOLGA * 2,
            height: caixa.height + FOLGA * 2,
            boxShadow: '0 0 0 9999px rgba(10, 14, 20, 0.62)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[rgba(10,14,20,0.62)]" />
      )}

      <div
        ref={cartaoRef}
        className="absolute w-[min(320px,calc(100vw-24px))] rounded-[20px] border border-black/5 bg-card p-4 shadow-2xl dark:border-white/5"
        style={estiloCartao}
      >
        <p className="text-xs tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">
          Passo {indice + 1} de {passos.length}
        </p>
        <h2 className="mt-1 text-[15px] font-semibold text-foreground">{passo.titulo}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{passo.texto}</p>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-[hsl(var(--sel,168_80%_27%))] transition-all duration-200"
            style={{ width: `${((indice + 1) / passos.length) * 100}%` }}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={encerrar}>
            Pular
          </Button>
          <span className="flex-1" />
          {indice > 0 && (
            <Button variant="outline" size="sm" onClick={() => setIndice((i) => i - 1)}>
              Voltar
            </Button>
          )}
          <Button size="sm" onClick={seguir}>
            {ultimo ? 'Entendi' : 'Próximo'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default JournalTutorial;
