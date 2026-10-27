import { ArrowUpRight, Instagram, Plus } from 'lucide-react';
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
    /* Esboço V2: um bloco sólido e calmo, sem brilho nem ícone de enfeite;
       um botão forte (Conhecer a ANA) e o resto discreto. */
    <section
      aria-labelledby="vitrine-vazia-titulo"
      className="rounded-[20px] border border-black/5 bg-card px-6 py-14 text-center dark:border-white/5 sm:px-10"
    >
      <h3 id="vitrine-vazia-titulo" className="text-2xl font-bold tracking-tight text-foreground">
        A próxima programação está sendo montada
      </h3>
      <p className="mx-auto mt-2 max-w-[46ch] text-muted-foreground">
        Assim que houver eventos confirmados, eles aparecem aqui. Enquanto isso, conheça a ANA e acompanhe as novidades.
      </p>
      {!semConvites && (
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        <Button asChild className="gap-2">
          <a href={SITE_DA_ANA} target="_blank" rel="noopener noreferrer">
            Conhecer a ANA <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
        {INSTAGRAM_DA_ANA && (
          <Button asChild variant="outline" className="gap-2">
            <a href={INSTAGRAM_DA_ANA} target="_blank" rel="noopener noreferrer">
              <Instagram className="h-4 w-4" aria-hidden="true" /> Instagram
            </a>
          </Button>
        )}
      </div>
      )}
      {onCriar && (
        <div className="mx-auto mt-7 flex max-w-md flex-wrap items-center justify-center gap-3 border-t border-border/70 pt-5 text-sm text-muted-foreground">
          <span>Só a equipe vê esta linha.</span>
          <Button size="sm" variant="ghost" className="gap-1.5 text-[hsl(var(--sel,168_80%_27%))]" onClick={onCriar}>
            <Plus className="h-3.5 w-3.5" /> Criar evento
          </Button>
        </div>
      )}
    </section>
  );
}

export default VitrineVazia;
