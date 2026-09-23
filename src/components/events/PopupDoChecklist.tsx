import { useState } from 'react';
import { CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { AppEvent } from '@/types';
import { eventUnitLabel } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { montarChecklist, resumoDoEvento, tamanhoDoChecklist } from '@/lib/events/checklist';
import { gerarChecklistPdf } from '@/lib/events/checklistPdf';
import { tituloEmTexto } from '@/lib/events/titulo';
import { textoDaData } from '@/lib/events/periodo';

/**
 * O pop-up de sucesso (22/09/2026, mockup aprovado): o que aconteceu, um
 * resumo curto do que foi preenchido e o botão para baixar o checklist.
 * Aparece ao criar, salvar alterações ou enviar para aprovação; o mesmo
 * checklist fica no detalhe do evento para baixar de novo.
 */
export interface Sucesso {
  evento: AppEvent;
  titulo: string;
  descricao: string;
}

interface Props {
  sucesso: Sucesso | null;
  onFechar: () => void;
}

export function PopupDoChecklist({ sucesso, onFechar }: Props) {
  const [gerando, setGerando] = useState(false);
  if (!sucesso) return null;
  const { evento, titulo, descricao } = sucesso;
  const checklist = montarChecklist(evento);
  const resumo = resumoDoEvento(evento);

  const baixar = async () => {
    setGerando(true);
    try {
      const { nome } = await gerarChecklistPdf(evento, checklist);
      toast.success('Checklist baixado', { description: nome });
    } catch (erro) {
      toast.error('Não deu para gerar o PDF', { description: erro instanceof Error ? erro.message : 'Tente de novo.' });
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open onOpenChange={aberto => { if (!aberto) onFechar(); }}>
      <DialogContent className="sm:max-w-md" data-testid="popup-do-checklist">
        <DialogHeader className="items-center text-center">
          <span className="mx-auto mb-1 inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        {resumo.length > 0 && (
          <dl className="grid grid-cols-1 gap-1.5 rounded-lg bg-muted/50 p-3 text-xs" data-testid="resumo-do-popup">
            {resumo.map(([a, b]) => (
              <div key={a} className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground shrink-0">{a}</dt>
                <dd className="font-semibold text-right">{b}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="space-y-2">
          <Button className="w-full gap-2" onClick={baixar} disabled={gerando}>
            <Download className="h-4 w-4" /> {gerando ? 'Gerando…' : `Baixar checklist do evento (PDF) · ${tamanhoDoChecklist(checklist)} itens`}
          </Button>
          <Button variant="outline" className="w-full" onClick={onFechar}>Fechar</Button>
          <p className="text-center text-[11px] text-muted-foreground">
            O checklist também fica no detalhe de “{tituloEmTexto(evento.title)}” ({textoDaData(evento, { comAno: false })} · {eventUnitLabel(evento.unit)}), em “Baixar checklist”.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PopupDoChecklist;
