import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { PERCURSOS, marcarVisto, type PercursoId } from '@/lib/journal/tutorial';

interface Props {
  percurso: PercursoId;
  aberto: boolean;
  onFechar: () => void;
}

/** Distância entre o holofote e a borda do elemento apontado. */
const FOLGA = 8;
/** Espaço que o cartão precisa para não encostar na borda da janela. */
const MARGEM = 12;

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
export function JournalTutorial({ percurso, aberto, onFechar }: Props) {
  const passos = PERCURSOS[percurso];
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
    marcarVisto(percurso);
    onFechar();
  }, [onFechar, percurso]);

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

  if (!aberto || !passo) return null;

  /* Posição do cartão: abaixo do alvo, ou acima se não couber. */
  const LARGURA_CARTAO = 320;
  let estiloCartao: React.CSSProperties;

  if (caixa) {
    const abaixo = caixa.top + caixa.height + FOLGA + 190 < window.innerHeight;
    const topo = abaixo ? caixa.top + caixa.height + FOLGA + 6 : Math.max(MARGEM, caixa.top - 196);
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
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Tutorial do Jornal">
      {/* O escurecimento com buraco: a sombra gigante cobre a tela inteira e o
          retângulo em si fica limpo, sem precisar de máscara nem de SVG.
          Sem transição de propósito — animar `top`/`left` faz o holofote entrar
          voando do canto da tela no primeiro passo. */}
      {caixa ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary"
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
        className="absolute w-[min(320px,calc(100vw-24px))] rounded-xl border border-border bg-card p-4 shadow-2xl"
        style={estiloCartao}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          Passo {indice + 1} de {passos.length}
        </p>
        <h2 className="mt-1 text-[15px] font-semibold text-foreground">{passo.titulo}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{passo.texto}</p>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-200"
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
