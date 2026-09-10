import { Globe, Instagram, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INSTAGRAM_DA_ANA, SITE_DA_ANA } from '@/lib/links';

/**
 * O que a página pública mostra quando não há evento confirmado nenhum.
 *
 * Até 08/09/2026 o visitante via título, uma caixa de busca e "Nenhum evento
 * encontrado. Tente ajustar sua busca" — sem busca a ajustar. Aqui a página
 * diz o que está acontecendo e convida a conhecer a ANA enquanto a
 * programação não sai.
 */
interface Props {
  /** Presente só para a equipe que pode criar: abre o formulário daqui. */
  onCriar?: () => void;
  /**
   * Dentro do iframe do site institucional, "Conhecer a ANA" e o Instagram
   * são redundantes: a pessoa já está no site da ANA. Só o texto fica.
   */
  semConvites?: boolean;
}

export function VitrineVazia({ onCriar, semConvites = false }: Props) {
  return (
    <section
      aria-labelledby="vitrine-vazia-titulo"
      className="relative overflow-hidden rounded-3xl border border-border bg-card px-7 py-14 text-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[60%] -left-[20%] -right-[20%] h-[70%] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.28),transparent_70%)]"
      />
      <div className="relative">
        <div className="mx-auto mb-5 grid h-[72px] w-[72px] place-items-center rounded-full bg-primary/20 text-primary-foreground">
          <Sparkles className="h-8 w-8" />
        </div>
        <h3 id="vitrine-vazia-titulo" className="text-2xl font-bold tracking-tight text-foreground">
          A próxima programação está sendo montada
        </h3>
        <p className="mx-auto mt-2 max-w-[46ch] text-muted-foreground">
          Assim que houver eventos confirmados, eles aparecem aqui. Enquanto isso, conheça a ANA e acompanhe as novidades.
        </p>
        {!semConvites && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <Button asChild className="rounded-full gap-2">
            <a href={SITE_DA_ANA} target="_blank" rel="noopener noreferrer">
              <Globe className="h-4 w-4" /> Conhecer a ANA
            </a>
          </Button>
          {INSTAGRAM_DA_ANA && (
            <Button asChild variant="outline" className="rounded-full gap-2 border-border">
              <a href={INSTAGRAM_DA_ANA} target="_blank" rel="noopener noreferrer">
                <Instagram className="h-4 w-4" /> Instagram
              </a>
            </Button>
          )}
        </div>
        )}
        {onCriar && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
            <span>Só a equipe vê esta linha.</span>
            <Button size="sm" variant="outline" className="rounded-full gap-1.5 border-border" onClick={onCriar}>
              <Plus className="h-3.5 w-3.5" /> Criar programação
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default VitrineVazia;
