import { AccessForm } from '@/components/auth/AccessForm';
import { TestModeTrigger } from '@/components/TestModeBanner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import {
  findJournalElement,
  shouldMirror,
  type JournalCornerKey,
} from '@/lib/journal/elements';
import { journalColor } from '@/lib/journal/types';
import logoImg from '@/assets/logo.png';

/** Forma escolhida: é a única cujo par espelhado fecha os dois cantos com a mesma silhueta. */
const SHAPE = findJournalElement('elemento_04');

/**
 * Forma ANA ancorada num canto inferior.
 *
 * Um padrão só, sem número escolhido a olho por breakpoint: a largura sai de
 * `clamp(140px, 20vw, 260px)`, mesma cor e mesma opacidade dos dois lados, e o
 * espelhamento vem de `shouldMirror()` — a mesma regra do Jornal. Aqui é
 * `<svg>` inline: a restrição de `<img>` existe por causa do html2canvas na
 * exportação do PDF, e esta tela não é exportada.
 */
function AnaShape({ corner, animate }: { corner: JournalCornerKey; animate: boolean }) {
  const [x, , viewWidth] = SHAPE.viewBox.split(' ').map(Number);
  const paths = SHAPE.paths.map((d, i) => <path key={i} d={d} fill={journalColor('verde_agua')} />);

  return (
    <svg
      viewBox={SHAPE.viewBox}
      aria-hidden="true"
      className={cn(
        // O piso de 88px é calibrado pela menor tela em uso, e não pela média:
        // a 320px, duas formas de 140px somavam 88% da largura e a moldura de
        // canto virava faixa. Com 88px dá 55%, e nada muda de 440px para cima.
        'ana-shape pointer-events-none absolute bottom-0 h-auto w-[clamp(88px,20vw,260px)]',
        animate && 'ana-enter-shape',
      )}
      style={corner === 'inferior_esquerdo' ? { left: 0 } : { right: 0 }}
    >
      {shouldMirror(SHAPE, corner) ? (
        <g transform={`translate(${2 * x + viewWidth},0) scale(-1,1)`}>{paths}</g>
      ) : (
        paths
      )}
    </svg>
  );
}

interface HomePageProps {
  /**
   * A sessão chegou e esta tela está saindo de cena.
   *
   * Nesse instante a porta vira uma camada fixa por cima do app, para que a
   * saída dela e a entrada dele aconteçam ao mesmo tempo — sem o buraco branco
   * que haveria se uma esperasse a outra terminar.
   */
  leaving?: boolean;
}

/**
 * Porta de entrada do app — o que aparece em `/` para quem chega sem sessão.
 *
 * Não altera permissão de rota nenhuma: as páginas públicas continuam públicas
 * nos seus endereços (as Programações em `/eventos`, o Mercado Solidário em
 * `/mercado-solidario`) e as restritas continuam atrás dos mesmos guardas.
 * O que muda é só o que a raiz mostra.
 *
 * A altura é `100svh` — a *small viewport height*, a menor que a tela assume,
 * com as barras do navegador visíveis. Com `100vh` (o `min-h-screen`) o rodapé
 * caía embaixo da barra e levava as formas junto: medido a 320×568, elas
 * ficavam 74px fora da tela mesmo antes de qualquer barra aparecer.
 *
 * Por isso as formas são ancoradas neste contêiner de altura fixa, e o miolo
 * vive num filho que rola. Se o card não couber — e numa tela de 568px ele não
 * cabe — ele rola, em vez de empurrar as formas para fora.
 */
export default function HomePage({ leaving = false }: HomePageProps) {
  /**
   * A camada de saída é uma montagem nova do componente. Sem isto ela tocaria a
   * animação de chegada de novo — o card entrando enquanto a tela apaga.
   */
  const animarEntrada = !leaving;

  return (
    <div
      className={cn(
        'h-[100svh] overflow-hidden bg-background',
        leaving ? 'ana-gate-leaving fixed inset-0 z-50' : 'relative',
      )}
    >
      <AnaShape corner="inferior_esquerdo" animate={animarEntrada} />
      <AnaShape corner="inferior_direito" animate={animarEntrada} />

      <div className="relative z-10 h-full overflow-y-auto overscroll-contain">
        {/* `min-h-full` com `justify-center`: centra quando sobra espaço e cresce
            quando falta, sem o topo virar área inalcançável do scroll.
            A compensação óptica é proporcional — os 104px fixos foram calibrados
            em telas de 660px e sozinhos já estouravam uma de 568px. */}
        <div
          className={cn(
            'ana-gate-core flex min-h-full w-full flex-col items-center justify-center gap-6',
            'p-4 pb-[clamp(1rem,13vh,6.5rem)]',
          )}
        >
          <div className={cn('flex items-center gap-2.5', animarEntrada && 'ana-enter-brand')}>
            <img src={logoImg} alt="" className="h-10 w-10 rounded-xl object-cover shadow-sm" />
            <span
              className="text-xl leading-none tracking-tighter lowercase text-foreground"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
            >
              anabrasil
            </span>
          </div>

          <div className={cn('w-full max-w-md', animarEntrada && 'ana-enter-card')}>
            <AccessForm
              title="Entre para continuar"
              loginDescription="Área restrita à equipe ANA Brasil."
              className="w-full"
              stagger={animarEntrada}
            />
          </div>
        </div>
      </div>

      {/* `viewport-fit=cover` está ligado no index.html: sem somar a área segura,
          estes botões caem sob a faixa de gestos do iPhone, onde o toque é do
          sistema. Pesa mais agora que o app é instalável e roda sem barra. */}
      <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.5rem+env(safe-area-inset-right))] z-[60] flex items-center gap-3">
        <TestModeTrigger floating />
        <ThemeToggle />
      </div>
    </div>
  );
}
