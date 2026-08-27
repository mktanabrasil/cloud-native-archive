import { useState, type ComponentPropsWithoutRef } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NEWS_UNIT_GROUPS, newsUnitName, findNewsUnit } from '@/lib/news/units';

export type UnitBadgeVariant = 'banner' | 'line' | 'chip';

export interface UnitBadgeProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  /** Id da unidade no catálogo (`NEWS_UNITS`). */
  unitId: string | null;
  variant?: UnitBadgeVariant;
  /** Texto pequeno acima do nome (apenas banner/linha). */
  label?: string;
  /** Frase de apoio (apenas banner). */
  hint?: string;
  /** Quando ausente, o selo é apenas informativo — sem seletor de troca. */
  onChangeUnit?: (unitId: string) => void;
  /**
   * O que a troca significa aqui.
   *
   * `mover` (padrão) é o do editor: o jornal passa a pertencer a outra
   * unidade. `ver` é o da listagem: muda só o que está na tela, e fora da
   * própria unidade tudo abre em leitura. Eram a mesma frase, e uma delas
   * estava mentindo.
   */
  modo?: 'mover' | 'ver';
}

/**
 * Selo de unidade reutilizável.
 * Toda troca de unidade passa por um diálogo de confirmação — nunca é aplicada direto.
 */
export function UnitBadge({
  unitId,
  variant = 'chip',
  label = 'Minha unidade',
  hint,
  onChangeUnit,
  modo = 'mover',
  className,
  ...rest
}: UnitBadgeProps) {
  const [pending, setPending] = useState<string | null>(null);
  const currentName = newsUnitName(unitId) || 'Institucional geral';
  const shortName = findNewsUnit(unitId)?.short ?? 'Institucional';

  const confirm = () => {
    if (pending) onChangeUnit?.(pending);
    setPending(null);
  };

  const selector = onChangeUnit ? (
    <Select
      value={unitId ?? ''}
      onValueChange={(value) => {
        if (value !== unitId) setPending(value);
      }}
    >
      {/* Largura limitada, e nunca `w-auto` solto: o nome de uma unidade
          chega a 43 caracteres ("CEI Bem Querer Sen. João de Medeiros Calmon")
          e o gatilho crescia até empurrar o diálogo de criação, que ganhava
          barra de rolagem horizontal. O `line-clamp-1` do gatilho já corta o
          texto com reticências assim que existe um teto. */}
      <SelectTrigger
        className={cn(
          'h-8 w-full max-w-full gap-1.5 text-xs sm:w-auto sm:max-w-[220px]',
          variant === 'chip' && 'h-7',
        )}
        aria-label="Trocar unidade"
      >
        <SelectValue placeholder="Trocar unidade" />
      </SelectTrigger>
      <SelectContent>
        {NEWS_UNIT_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.units.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  ) : null;

  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {modo === 'ver' ? 'Ver os jornais de outra unidade?' : 'Trocar a unidade?'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">De: </span>
                  <span className="font-medium text-foreground">{currentName}</span>
                </p>
                <p className="mt-1">
                  <span className="text-muted-foreground">Para: </span>
                  <span className="font-semibold text-primary">{newsUnitName(pending)}</span>
                </p>
              </div>
              {modo === 'ver' ? (
                <p>
                  Fora da sua unidade, tudo abre em <strong>somente leitura</strong>: dá para abrir,
                  ler e exportar, e duplicar para a sua unidade se quiser aproveitar algum — mas não
                  editar. Sua unidade continua a mesma.
                </p>
              ) : (
                <p>
                  O conteúdo desta tela passará a pertencer à unidade escolhida e a listagem mostrará
                  os jornais dessa unidade.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirm}>Sim, trocar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (variant === 'chip') {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)} {...rest}>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          {shortName}
        </span>
        {selector}
        {dialog}
      </div>
    );
  }

  if (variant === 'line') {
    return (
      <div className={cn('flex flex-wrap items-center gap-2 text-xs text-muted-foreground', className)} {...rest}>
        <Building2 className="h-4 w-4" />
        <span>{label}</span>
        <span className="font-semibold text-foreground">{currentName}</span>
        {selector}
        {dialog}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      {...rest}
    >
      {/* `min-w-0` aqui também, e não só no filho: em flex, um item se
          recusa a encolher abaixo do próprio conteúdo sem isso, e o `truncate`
          de dentro nunca chega a valer. */}
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Building2 className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-base font-bold text-foreground">{currentName}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {selector && <div className="w-full min-w-0 sm:w-auto sm:shrink-0">{selector}</div>}
      {dialog}
    </div>
  );
}

export default UnitBadge;
