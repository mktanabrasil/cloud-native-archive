import { useMemo } from 'react';
import { GRUPO } from '@/lib/events/grupo';
import { useApp } from '@/contexts/AppContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useViewConfigs } from '@/hooks/useViewConfigs';

export function useFilteredEvents(isPublicView: boolean = false, showTrash: boolean = false) {
  const { events } = useApp();
  const { viewRestrictions, permissionLevel, isAdmin } = useUserRole();
  const { configs } = useViewConfigs();

  const filteredEvents = useMemo(() => {
    // Basic filter to exclude deleted events unless showing trash
    const baseEvents = events.filter(e => showTrash ? !!e.deleted_at : !e.deleted_at);

    // Se for visão pública, aplica filtro simplificado
    if (isPublicView) {
      return baseEvents.filter(event => event.status === 'confirmado' && event.visibility === 'publico');
    }

    // Admins sempre veem tudo (respeitando o filtro de lixeira)
    if (isAdmin) return baseEvents;

    // Determinar unidades permitidas seguindo lógica de mercado
    let allowedUnits: string[] | null = null;

    if (configs?.enable_role_based_view) {
      // 1. MODO CARGO ATIVO: O padrão do cargo tem precedência TOTAL e ignora personalizações individuais
      if (permissionLevel && configs?.role_defaults?.[permissionLevel]) {
        allowedUnits = configs.role_defaults[permissionLevel];
      } else {
        // Se o sistema está ativo mas não há regra para o cargo, por segurança não mostramos nada
        return [];
      }
    } else {
      // 2. MODO CARGO DESATIVADO: Permite personalizações individuais ou acesso total
      if (viewRestrictions !== null && viewRestrictions !== undefined) {
        allowedUnits = viewRestrictions;
      } else {
        // Sem restrições de cargo E sem restrição individual = Acesso Total
        return events;
      }
    }

    if (allowedUnits === null) return [];

    // Filtra os eventos pelas unidades permitidas
    // O evento do Grupo ANA Brasil é de todas as unidades (11/11/2026).
    return baseEvents.filter(event => allowedUnits.includes(event.unit) || event.unit === GRUPO);
  }, [events, viewRestrictions, permissionLevel, configs, isAdmin, isPublicView, showTrash]);

  return filteredEvents;
}
