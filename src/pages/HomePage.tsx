import { AccessForm } from '@/components/auth/AccessForm';
import { TestModeTrigger } from '@/components/TestModeBanner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { InstitutionalFooterBar } from '@/components/news/InstitutionalFooterBar';
import logoImg from '@/assets/logo.png';

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
 * caía embaixo da barra e levava consigo o que estivesse ancorado nele: medido
 * a 320×568, ficava 74px fora da tela antes de qualquer barra aparecer.
 *
 * Por isso o fio é ancorado neste contêiner de altura fixa, e o miolo vive num
 * filho que rola. Se o card não couber — e numa tela de 568px ele não cabe —
 * ele rola, em vez de empurrar o fio para fora.
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
      {/* Assinatura institucional: a mesma faixa de cinco cores que fecha o
          rodapé de todo jornal e informativo, reduzida a um fio. Ao contrário
          das formas orgânicas — vocabulário do Jornal —, ela vale para a
          instituição inteira, e por isso pode assinar a porta do app. */}
      <InstitutionalFooterBar
        className={cn(
          // A altura repetida no `md:` não é descuido: o componente traz
          // `h-3 md:h-4`, e o twMerge só derruba a classe sem variante — sem
          // repetir, o fio engrossaria para 16px no desktop.
          'absolute inset-x-0 bottom-0 z-0 h-[6px] md:h-[6px]',
          animarEntrada && 'ana-enter-fio',
        )}
      />

      <div className="relative z-10 h-full overflow-y-auto overscroll-contain">
        {/* `min-h-full` com `justify-center`: centra quando sobra espaço e cresce
            quando falta, sem o topo virar área inalcançável do scroll.
            O recuo de baixo encolheu junto com as formas: ele existia para o
            cartão não encostar num desenho de até 260px de altura, e agora só
            precisa dar respiro e livrar os botões flutuantes do canto. */}
        <div
          className={cn(
            'ana-gate-core flex min-h-full w-full flex-col items-center justify-center gap-6',
            'p-4 pb-[clamp(1rem,7vh,3.5rem)]',
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
