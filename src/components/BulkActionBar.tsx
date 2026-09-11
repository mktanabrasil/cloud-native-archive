import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, X, CheckSquare, Rocket } from 'lucide-react';
import { EventStatus, EVENT_STATUSES } from '@/types';

interface BulkEventActionBarProps {
  type: 'events';
  count: number;
  onClearSelection: () => void;
  onDelete: () => void;
  onChangeStatus: (status: EventStatus) => void;
}

interface BulkUserActionBarProps {
  type: 'users';
  count: number;
  onClearSelection: () => void;
  onDelete: () => void;
  onToggleActive: (active: boolean) => void;
  onToggleBeta?: (beta: boolean) => void;
}


type BulkActionBarProps = BulkEventActionBarProps | BulkUserActionBarProps;

export default function BulkActionBar(props: BulkActionBarProps) {
  if (props.count === 0) return null;

  return (
    <div className="sticky top-16 z-40 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <CheckSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          {props.count} {props.type === 'events' ? 'evento(s)' : 'usuário(s)'} selecionado(s)
        </span>
      </div>

      <div className="flex items-center gap-2 sm:ml-auto">
        {props.type === 'events' && (
          <Select onValueChange={(v) => (props as BulkEventActionBarProps).onChangeStatus(v as EventStatus)}>
            <SelectTrigger className="flex-1 h-9 text-xs sm:w-[160px] sm:h-8">
              <SelectValue placeholder="Alterar status" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_STATUSES.map(s => (
                <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {props.type === 'users' && (
          <div className="flex flex-1 gap-2 sm:flex-initial">
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs sm:h-8 sm:px-3" onClick={() => (props as BulkUserActionBarProps).onToggleActive(false)}>
              Desativar
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs sm:h-8 sm:px-3" onClick={() => (props as BulkUserActionBarProps).onToggleActive(true)}>
              Ativar
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs sm:h-8 sm:px-3 gap-1.5" onClick={() => (props as BulkUserActionBarProps).onToggleBeta?.(true)}>
              <Rocket className="h-3.5 w-3.5 text-primary" />
              Beta ON
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs sm:h-8 sm:px-3" onClick={() => (props as BulkUserActionBarProps).onToggleBeta?.(false)}>
              Beta OFF
            </Button>
          </div>

        )}

        <Button
          size="sm"
          variant="destructive"
          className="h-9 text-xs gap-1 sm:h-8"
          aria-label={props.type === 'events' ? 'Mover para a lixeira' : 'Excluir'}
          onClick={props.onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{props.type === 'events' ? 'Lixeira' : 'Excluir'}</span>
        </Button>

        <Button size="sm" variant="ghost" className="h-9 w-9 p-0 sm:h-8 sm:w-8" aria-label="Limpar seleção" onClick={props.onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
