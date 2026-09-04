import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppEvent, AppUser } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SELECT_PUBLICO } from '@/lib/events/camposPublicos';
import { descreverErroDeGravacao } from '@/lib/events/mensagemDeErro';

interface AppContextType {
  events: AppEvent[];
  users: AppUser[];
  loading: boolean;
  selectedEvent: AppEvent | null;
  selectedUser: AppUser | null;
  selectedMonth: Date;
  setSelectedEvent: (event: AppEvent | null) => void;
  setSelectedUser: (user: AppUser | null) => void;
  setSelectedMonth: (date: Date) => void;
  addEvent: (event: Partial<AppEvent>) => Promise<void>;
  updateEvent: (event: AppEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  restoreEvent: (id: string) => Promise<void>;
  updateUser: (user: AppUser) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  detectConflicts: (event: AppEvent) => AppEvent[];
  refetchEvents: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  /**
   * Quem não tem sessão recebe só as colunas da vitrine.
   *
   * O `*` mandava a linha inteira para o navegador de qualquer visitante —
   * inclusive as anotações internas de logística. A tela nunca mostrou isso,
   * mas estava no tráfego. Agora a consulta pede o que a tela usa, e nada
   * mais; ver `camposPublicos.ts` para o que entra na lista e por quê.
   *
   * As permissões de coluna no banco fecham o resto: mesmo pedindo `*`, a
   * chave pública não alcança as colunas internas.
   */
  const fetchEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(isAuthenticated ? '*' : SELECT_PUBLICO);
      
      if (error) throw error;
      
      // Adapt DB events to AppEvent type
      const adaptedEvents: AppEvent[] = (data || []).map((e: any) => ({
        ...e,
        attachments: Array.isArray(e.attachments) ? e.attachments : [],
        collaborating_units: Array.isArray(e.collaborating_units) ? e.collaborating_units : [],
        external_collaborators: Array.isArray(e.external_collaborators) ? e.external_collaborators : [],
        partners: Array.isArray(e.partners) ? e.partners : [],
        marketing_items: Array.isArray(e.marketing_items) ? e.marketing_items : [],
      }));
      
      setEvents(adaptedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Espera a sessão se resolver: buscar antes traria a lista pública para
    // quem está logado, e obrigaria a uma segunda busca no quadro seguinte.
    if (authLoading) return;
    fetchEvents();
  }, [authLoading, fetchEvents]);

  const detectConflicts = useCallback((event: AppEvent): AppEvent[] => {
    return events.filter(e => {
      if (e.id === event.id) return false;
      if (e.status === 'cancelado' || event.status === 'cancelado') return false;
      const eStart = new Date(e.start_datetime).getTime();
      const eEnd = new Date(e.end_datetime).getTime();
      const eventStart = new Date(event.start_datetime).getTime();
      const eventEnd = new Date(event.end_datetime).getTime();
      const sameScope = e.unit === event.unit || e.unit === 'Administração' || event.unit === 'Administração';
      return sameScope && eStart < eventEnd && eEnd > eventStart;
    });
  }, [events]);

  /**
   * Avisa o que deu errado, com nome.
   *
   * Era "Erro ao adicionar evento" para tudo. Agora a frase diz se foi
   * permissão, campo, rede… O slug duplicado fica de fora: o formulário
   * trata sozinho (ajusta o sufixo e tenta de novo), e um toast aqui só
   * confundiria.
   */
  const avisarFalha = (error: unknown, acao: 'criar' | 'atualizar', event: Partial<AppEvent>) => {
    const d = descreverErroDeGravacao(error, { acao, unidade: event.unit, slug: event.slug });
    if (d.tipo !== 'slug') toast.error(d.titulo, { description: d.descricao });
  };

  const addEvent = async (event: Partial<AppEvent>) => {
    // @ts-ignore - Supabase type mismatch with AppEvent
    const { error } = await supabase.from('events').insert([event]);
    if (error) {
      avisarFalha(error, 'criar', event);
      throw error;
    }
    await fetchEvents();
  };

  const updateEvent = async (event: AppEvent) => {
    // `.select('id')` para saber se alguma linha mudou. Quando o RLS filtra a
    // linha (gestora editando um evento já confirmado), o UPDATE não dá erro:
    // afeta zero linhas e volta em silêncio — e a tela diria "salvo".
    // @ts-ignore
    const { data, error } = await supabase.from('events').update(event).eq('id', event.id).select('id');
    if (error) {
      avisarFalha(error, 'atualizar', event);
      throw error;
    }
    if (!data || data.length === 0) {
      const nada = Object.assign(new Error('permission denied: nenhuma linha foi alterada'), { code: '42501' });
      avisarFalha(nada, 'atualizar', event);
      throw nada;
    }
    await fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    const eventToDelete = events.find(e => e.id === id);
    
    // If already in trash, delete permanently
    if (eventToDelete?.deleted_at) {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) {
        toast.error('Erro ao excluir permanentemente');
        throw error;
      }
      toast.success('Evento excluído permanentemente');
    } else {
      // Move to trash
      const { error } = await supabase.from('events').update({ 
        deleted_at: new Date().toISOString() 
      }).eq('id', id);
      
      if (error) {
        toast.error('Erro ao mover para a lixeira');
        throw error;
      }
      toast.success('Evento movido para a lixeira');
    }
    await fetchEvents();
  };

  /**
   * Tira o evento da lixeira.
   *
   * A lixeira é `deleted_at` preenchido, e nada mais — a linha nunca saiu do
   * banco. Restaurar é apagar essa data, e o evento volta exatamente para
   * onde estava, com a mesma unidade, o mesmo status e o mesmo banner.
   */
  const restoreEvent = async (id: string) => {
    const { error } = await supabase.from('events').update({ deleted_at: null }).eq('id', id);
    if (error) {
      toast.error('Erro ao restaurar o evento');
      throw error;
    }
    toast.success('Evento restaurado');
    await fetchEvents();
  };

  const updateUser = async (user: AppUser) => {
    // Logic for updating user in DB
    await fetchEvents();
  };

  const deleteUser = async (id: string) => {
    // Logic for deleting user in DB
    await fetchEvents();
  };

  return (
    <AppContext.Provider value={{
      events, users, loading, selectedEvent, selectedUser, selectedMonth,
      setSelectedEvent, setSelectedUser, setSelectedMonth,
      addEvent, updateEvent, deleteEvent, restoreEvent, updateUser, deleteUser, detectConflicts,
      refetchEvents: fetchEvents
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
