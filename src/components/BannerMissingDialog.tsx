import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImagePlus, CheckCircle2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onAddImage: () => void;
}

export function BannerMissingDialog({ open, onOpenChange, onConfirm, onAddImage }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Esboço V2: sem o círculo âmbar; o aviso fica no texto, e as duas
            saídas viram duas linhas de escolha (a recomendada em contorno). */}
        <DialogHeader>
          <DialogTitle className="text-xl">Banner sem imagem!</DialogTitle>
          <DialogDescription className="pt-1">
            Este evento não possui uma arte de banner dedicada. Se você publicar assim, usaremos a <strong>cor do card</strong> como fundo e o <strong>título ganhará destaque total</strong> no carrossel.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 py-2">
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 rounded-2xl px-4 py-3.5 text-left"
            onClick={onAddImage}
          >
            <ImagePlus className="h-5 w-5 shrink-0 text-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Adicionar Imagem agora</span>
              <span className="block text-xs font-normal text-muted-foreground">Recomendado para melhor visual</span>
            </span>
          </Button>

          <Button
            variant="ghost"
            className="h-auto justify-start gap-3 rounded-2xl px-4 py-3.5 text-left hover:bg-muted"
            onClick={onConfirm}
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Publicar sem imagem</span>
              <span className="block text-xs font-normal text-muted-foreground">Usar cor e título em destaque</span>
            </span>
          </Button>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button variant="link" className="text-muted-foreground text-xs" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
