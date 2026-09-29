import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReduzMovimento } from '@/hooks/useReduzMovimento';
import { AVIAO_CLARO, AVIAO_DO_LOGO_D, AVIAO_NO_QUADRADO, CANTO_DO_QUADRADO, VERDE_DO_LOGO, curvaDoVoo, transformDoAviao } from './aviaoDoLogo';

/**
 * A linha de voo do Trabalhe Conosco (mockups 04, 05 e 05b).
 *
 * Login (28/09/2026, depois de onze mockups): o avião do logotipo voa sozinho,
 * claro e sem fundo, por cima das letras, pela linha tracejada; cada parada acende quando ele
 * passa; a última é verde. Só quando ele chega nela o pouso acontece: sai uma
 * onda, o quadrado verde cresce girando por trás dele, o avião assenta
 * no lugar, e o que fica é o logotipo da ANA.
 *
 * O voo e o pouso andam no MESMO relógio (requestAnimationFrame): com o voo
 * em SMIL e o pouso num temporizador, os dois se desencontravam e o verde
 * aparecia antes da hora. E o quadrado verde nem existe no desenho até o
 * pouso: não fica escondido esperando, é criado na chegada.
 *
 * Quem pede menos movimento vê o fim, parado: o logotipo na última parada.
 */

const AREIA = '#F5DFBB';
const AMARELO = '#FBCE00';
const AZUL = '#01ADFF';
const CORAL = '#F37964';
/** O logotipo inteiro (com o quadrado verde), usado no cadastro, que sobe de parada em parada. */
const AVIAO = '/logo.png';

const DECOLAGEM_MS = 700;
const VOO_MS = 1900;

// --- Login: "inspirar voos mais altos." em escada ------------------------------

const ESCADA = {
  largo: {
    vb: '0 0 860 540', fonte: 92, bolinha: 8, quadrado: 84,
    d: 'M 20 500 C 160 500, 190 340, 300 300 S 480 200, 560 120 S 720 30, 810 30',
    paradas: [[20, 500, AREIA], [300, 300, AMARELO], [560, 120, AZUL], [810, 30, VERDE_DO_LOGO]] as const,
    palavras: [['inspirar', 0, 530], ['voos', 150, 350], ['mais', 250, 170]] as const,
  },
  estreito: {
    vb: '0 0 358 230', fonte: 46, bolinha: 6, quadrado: 52,
    d: 'M 8 215 C 80 215, 110 150, 170 130 S 280 80, 340 36',
    paradas: [[8, 215, AREIA], [170, 130, AMARELO], [340, 36, VERDE_DO_LOGO]] as const,
    palavras: [['inspirar', 0, 110], ['voos', 56, 160], ['mais', 112, 210]] as const,
  },
};

/** Se o navegador mede a linha (o jsdom dos testes e alguns navegadores antigos não medem). */
const mede = (p: SVGPathElement | null): p is SVGPathElement => !!p && typeof p.getTotalLength === 'function' && typeof p.getPointAtLength === 'function';

/** Comprimento do trecho da linha até cada parada, em fração (0 a 1). Sem medida: espaçadas por igual. */
function fracoes(path: SVGPathElement | null, paradas: ReadonlyArray<readonly [number, number, string]>): number[] {
  if (!mede(path)) return paradas.map((_, i) => i / Math.max(1, paradas.length - 1));
  const len = path.getTotalLength();
  return paradas.map(([cx, cy]) => {
    let melhor = 0, dist = Infinity;
    for (let i = 0; i <= 200; i++) {
      const p = path.getPointAtLength((len * i) / 200);
      const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
      if (d < dist) { dist = d; melhor = i / 200; }
    }
    return melhor;
  });
}

export function FraseEmEscada({ estreito = false }: { estreito?: boolean }) {
  const e = estreito ? ESCADA.estreito : ESCADA.largo;
  const reduz = useReduzMovimento();
  const trilha = useRef<SVGPathElement>(null);
  const voa = useRef<SVGGElement>(null);
  const mais = useRef<SVGTextElement>(null);
  const [xAltos, setXAltos] = useState<number | null>(null);
  // Quantas paradas o avião já passou, e se já pousou.
  const [acesas, setAcesas] = useState(reduz ? e.paradas.length : 0);
  const [pousou, setPousou] = useState(reduz);
  const [voando, setVoando] = useState(reduz);
  const [px, py] = e.paradas[e.paradas.length - 1];

  // "altos." logo depois de "mais", medido na fonte que carregou.
  useLayoutEffect(() => {
    const medir = () => {
      const t = mais.current;
      // Sem medida de texto, a estimativa da largura média da Poppins em negrito.
      const largura = t && typeof t.getComputedTextLength === 'function' ? t.getComputedTextLength() : e.palavras[2][0].length * e.fonte * 0.6;
      setXAltos(e.palavras[2][1] + largura + e.fonte * 0.25);
    };
    medir();
    document.fonts?.ready.then(medir).catch(() => { /* fica a medida da fonte de reserva */ });
  }, [e]);

  // O relógio único: decola, voa pela linha, acende as paradas na passagem e, só na chegada, pousa.
  useEffect(() => {
    const path = trilha.current;
    const g = voa.current;
    const por = (x: number, y: number) => g?.setAttribute('transform', `translate(${x} ${y})`);
    if (reduz || !mede(path)) {
      por(px, py); setAcesas(e.paradas.length); setVoando(true); setPousou(true);
      return;
    }
    const len = path.getTotalLength();
    const fr = fracoes(path, e.paradas);
    const inicio = path.getPointAtLength(0);
    por(inicio.x, inicio.y); setAcesas(0); setPousou(false); setVoando(false);
    let quadro = 0;
    let ultimas = 0;
    const espera = window.setTimeout(() => {
      setVoando(true);
      const t0 = performance.now();
      const passo = (t: number) => {
        const k = Math.min(1, (t - t0) / VOO_MS);
        const avanco = curvaDoVoo(k);
        const p = path.getPointAtLength(len * avanco);
        por(p.x, p.y);
        const passadas = fr.filter(f => avanco >= f - 0.004).length;
        if (passadas !== ultimas) { ultimas = passadas; setAcesas(passadas); }
        if (k < 1) quadro = requestAnimationFrame(passo);
        else { por(px, py); setAcesas(e.paradas.length); setPousou(true); }
      };
      quadro = requestAnimationFrame(passo);
    }, DECOLAGEM_MS);
    return () => { window.clearTimeout(espera); cancelAnimationFrame(quadro); };
  }, [e, reduz, px, py]);

  const Q = e.quadrado;
  const larguraDoAviao = Q * AVIAO_NO_QUADRADO;
  const transformAviao = useMemo(() => transformDoAviao(larguraDoAviao), [larguraDoAviao]);

  return (
    <svg viewBox={e.vb} className="h-auto w-full overflow-visible" role="img" aria-label="inspirar voos mais altos.">
      <path ref={trilha} d={e.d} fill="none" stroke="hsl(var(--muted-foreground) / 0.45)" strokeWidth={estreito ? 2 : 2.5} strokeDasharray="7 9" strokeLinecap="round" />
      {/* Tampa da cor do fundo: sai de cima da linha, e ela parece se desenhar. */}
      {!reduz && (
        <path d={e.d} fill="none" stroke="var(--vg-fundo, hsl(var(--background)))" strokeWidth={10} pathLength={1}
          style={{ strokeDasharray: '1 1', animation: `vg-traca ${VOO_MS / 1000}s cubic-bezier(.45,0,.2,1) ${DECOLAGEM_MS / 1000}s both` }} />
      )}
      {e.paradas.map(([cx, cy, cor], i) => (
        <circle key={i} cx={cx} cy={cy} r={e.bolinha} fill={cor} data-parada={i}
          className={i < acesas ? (reduz ? undefined : 'vg-acende') : 'vg-apagada'} />
      ))}
      {/* A animação fica nos <g>, nunca no <text>: animado direto, o texto
          deixava no Chrome uma linha fina atravessando a tela (28/09/2026). */}
      {e.palavras.map(([t, x, y], i) => (
        <g key={t} className={reduz ? undefined : 'vg-degrau-g'} style={{ ['--vg-i' as string]: i }}>
          <text ref={i === 2 ? mais : undefined} x={x} y={y}
            fill="hsl(var(--foreground))" fontFamily="Poppins, system-ui, sans-serif" fontWeight={700} fontSize={e.fonte} letterSpacing="-0.04em">
            {t}
          </text>
        </g>
      ))}
      {xAltos !== null && (
        <g className={reduz ? undefined : 'vg-degrau-g'} style={{ ['--vg-i' as string]: 2 }}>
          <g className={reduz ? undefined : 'vg-pulo-g'}>
            <text x={xAltos} y={e.palavras[2][2]} fill={CORAL} fontFamily="Poppins, system-ui, sans-serif" fontWeight={700} fontSize={e.fonte} letterSpacing="-0.04em">
              altos.
            </text>
          </g>
        </g>
      )}
      {/* O pouso: só existe depois que o avião chega. Vem antes do avião no desenho, para ficar por trás dele. */}
      {pousou && (
        <g transform={`translate(${px} ${py})`} data-testid="pouso">
          {!reduz && <circle r={Q / 2} fill="none" stroke={VERDE_DO_LOGO} strokeWidth={3} className="vg-onda" />}
          <rect x={-Q / 2} y={-Q / 2} width={Q} height={Q} rx={Q * CANTO_DO_QUADRADO} fill={VERDE_DO_LOGO} className={reduz ? undefined : 'vg-gira'} />
        </g>
      )}
      {/* O avião: só vetor, claro desde a decolagem e sem contorno (29/09/2026), e o
          último do desenho, para passar por cima das letras. */}
      <g ref={voa} opacity={voando ? 1 : 0} data-testid="aviao">
        <g className={pousou && !reduz ? 'vg-assenta' : undefined}>
          <path d={AVIAO_DO_LOGO_D} transform={transformAviao} fill={AVIAO_CLARO} />
        </g>
      </g>
    </svg>
  );
}

// --- Cadastro: três paradas, o avião sobe a cada resposta ------------------------

const PASSOS_D = 'M 30 150 C 110 150, 140 110, 200 95 S 330 60, 380 30';
const PASSOS_PARADAS: ReadonlyArray<readonly [number, number, string]> = [[30, 150, CORAL], [200, 95, AMARELO], [380, 30, AZUL]];

/**
 * `atual` = parada em que o avião está (0, 1 ou 2); `concluido` = passou da
 * última: o avião decola e some. Paradas já alcançadas acendem na cor delas.
 */
export function LinhaDePassos({ atual, concluido = false }: { atual: number; concluido?: boolean }) {
  const reduz = useReduzMovimento();
  const trilha = useRef<SVGPathElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: PASSOS_PARADAS[0][0], y: PASSOS_PARADAS[0][1] });
  const fr = useRef<number[]>([0, 0.5, 1]);
  const kAtual = useRef(0);

  useEffect(() => { fr.current = fracoes(trilha.current, PASSOS_PARADAS); }, []);

  // Voa pela linha (não em reta) até a parada nova, em 600 ms.
  useEffect(() => {
    const path = trilha.current;
    const i = Math.min(atual, PASSOS_PARADAS.length - 1);
    // Sem medida da linha: o avião vai direto para a parada.
    if (!mede(path)) { setPos({ x: PASSOS_PARADAS[i][0], y: PASSOS_PARADAS[i][1] }); return; }
    const len = path.getTotalLength();
    const alvo = fr.current[i];
    const de = kAtual.current;
    if (reduz || de === alvo) { const p = path.getPointAtLength(len * alvo); setPos({ x: p.x, y: p.y }); kAtual.current = alvo; return; }
    let quadro = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      const s = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      const p = path.getPointAtLength(len * (de + (alvo - de) * s));
      setPos({ x: p.x, y: p.y });
      if (k < 1) quadro = requestAnimationFrame(passo); else kAtual.current = alvo;
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [atual, reduz]);

  return (
    <svg viewBox="0 0 410 190" className="h-auto w-full max-w-[520px] overflow-visible" aria-hidden="true">
      <path ref={trilha} d={PASSOS_D} fill="none" stroke="hsl(var(--muted-foreground) / 0.45)" strokeWidth={2} strokeDasharray="6 8" strokeLinecap="round" />
      {PASSOS_PARADAS.map(([cx, cy, cor], i) => {
        const acesa = i <= atual || concluido;
        return (
          <circle key={i} cx={cx} cy={cy} r={acesa ? 9 : 7} fill={acesa ? cor : 'hsl(var(--background))'} stroke={acesa ? cor : 'hsl(var(--muted-foreground) / 0.45)'} strokeWidth={2}
            style={{ transition: reduz ? undefined : 'r .35s cubic-bezier(.3,1.6,.4,1), fill .3s ease, stroke .3s ease' }} />
        );
      })}
      <g style={{
        transform: concluido ? `translate(${pos.x + 90}px, ${pos.y - 80}px)` : `translate(${pos.x}px, ${pos.y}px)`,
        opacity: concluido ? 0 : 1,
        transition: concluido && !reduz ? 'transform .7s cubic-bezier(.45,0,.2,1), opacity .7s ease' : undefined,
      }}>
        <image href={AVIAO} x={-22} y={-50} width={44} height={44} style={{ filter: 'drop-shadow(0 4px 8px rgba(31,35,34,.2))' }} />
      </g>
    </svg>
  );
}

/** Onde a frase em escada cabe inteira: o layout escolhe a versão larga ou a estreita. */
export function useLarguraDaEscada(): 'largo' | 'estreito' {
  const [largo, setLargo] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const mudar = () => setLargo(mq.matches);
    mq.addEventListener('change', mudar);
    return () => mq.removeEventListener('change', mudar);
  }, []);
  return useMemo(() => (largo ? 'largo' : 'estreito'), [largo]);
}
