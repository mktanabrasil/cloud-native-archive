import { Globe, Instagram } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { INSTAGRAM_DA_ANA, SITE_DA_ANA } from '@/lib/links';

/**
 * O rodapé da página pública de eventos.
 *
 * Para a família que chegou pelo link do WhatsApp, é o único convite para
 * conhecer a ANA além do evento. Até 08/09/2026 ele dizia só o copyright, com
 * a logo em cinza e "anabrasil" em minúsculo. Aparece para o visitante e para
 * quem ligou "Ver como visitante"; a equipe, no modo equipe, não o vê.
 */
export const FRASE_DA_ANA = 'Construindo oportunidades para transformar vidas e inspirar voos mais altos.';

export function RodapePublico() {
  return (
    <footer className="bg-card border-t border-border py-11 px-6 mt-12">
      <div className="max-w-7xl mx-auto text-center">
        <img src={logoImg} alt="ANA Brasil" className="h-8 w-8 rounded-lg mx-auto" />
        <p className="mt-2.5 text-[17px] font-bold text-foreground">ANA Brasil</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-muted-foreground">{FRASE_DA_ANA}</p>
        <nav aria-label="Conheça a ANA" className="mt-[18px] flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium">
          <a href={SITE_DA_ANA} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors">
            <Globe className="h-[15px] w-[15px]" /> anabrasil.org
          </a>
          {INSTAGRAM_DA_ANA && (
            <a href={INSTAGRAM_DA_ANA} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors">
              <Instagram className="h-[15px] w-[15px]" /> @anabrasilorg
            </a>
          )}
        </nav>
        <p className="mt-[22px] text-sm text-muted-foreground">
          © {new Date().getFullYear()} ANA Brasil. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}

export default RodapePublico;
