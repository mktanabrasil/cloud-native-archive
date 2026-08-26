import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { JournalPage, JournalPaperKey, JournalRecord } from '@/lib/journal/types';

export interface JournalDraft {
  name: string;
  unitId: string | null;
  profileUnit: string | null;
  referenceMonth: string | null;
  status: JournalRecord['status'];
  pages: JournalPage[];
  /**
   * Opcional na criação de propósito: sem valor a coluna fica nula, e a
   * leitura resolve para o padrão. Só passa a ser gravada quando a pessoa
   * escolhe um fundo.
   */
  paper?: JournalPaperKey;
}

/**
 * CRUD + autosave dos jornais institucionais.
 * O acesso é garantido no banco por RLS (apenas Marketing/Admin Geral).
 */
export function useJournals() {
  const { user } = useAuth();
  const [journals, setJournals] = useState<JournalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const currentIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('journals')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (!error && data) setJournals(data as unknown as JournalRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (draft: JournalDraft): Promise<JournalRecord | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('journals')
        .insert({
          name: draft.name || 'Nova edição',
          unit_id: draft.unitId,
          profile_unit: draft.profileUnit,
          reference_month: draft.referenceMonth,
          status: draft.status,
          pages: draft.pages as any,
          created_by: user.id,
        })
        .select()
        .single();
      if (error || !data) return null;
      await refresh();
      return data as unknown as JournalRecord;
    },
    [user, refresh],
  );

  const save = useCallback(
    async (id: string, draft: Partial<JournalDraft>) => {
      setSaving(true);
      const row: Record<string, unknown> = {};
      if (draft.name !== undefined) row.name = draft.name;
      if (draft.unitId !== undefined) row.unit_id = draft.unitId;
      if (draft.profileUnit !== undefined) row.profile_unit = draft.profileUnit;
      if (draft.referenceMonth !== undefined) row.reference_month = draft.referenceMonth;
      if (draft.status !== undefined) row.status = draft.status;
      if (draft.pages !== undefined) row.pages = draft.pages;
      if (draft.paper !== undefined) row.paper = draft.paper;

      const { error } = await supabase.from('journals').update(row as any).eq('id', id);
      setSaving(false);
      if (!error) {
        setSavedAt(
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        );
        setJournals((prev) =>
          prev.map((j) => (j.id === id ? ({ ...j, ...row } as JournalRecord) : j)),
        );
      }
      return !error;
    },
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from('journals').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (currentIdRef.current === id) currentIdRef.current = null;
      refresh();
    },
    [refresh],
  );

  /**
   * Duplica um jornal, opcionalmente para outra unidade.
   *
   * O destino existe por causa da leitura entre unidades: ver um jornal bom de
   * outra unidade e não poder partir dele seria uma limitação sem motivo. A
   * cópia nasce na unidade de quem duplicou, e por isso é dela para editar —
   * a RLS aceita a inserção justamente porque `profile_unit` é o da pessoa.
   */
  const duplicate = useCallback(
    async (journal: JournalRecord, destino?: { unitId: string | null; profileUnit: string | null }) => {
      if (!user) return;
      await supabase.from('journals').insert({
        name: `${journal.name} (cópia)`,
        unit_id: destino ? destino.unitId : journal.unit_id,
        profile_unit: destino ? destino.profileUnit : journal.profile_unit,
        reference_month: journal.reference_month,
        status: 'rascunho',
        pages: journal.pages as any,
        // a cópia tem de nascer com a mesma aparência do original
        paper: journal.paper,
        created_by: user.id,
      });
      refresh();
    },
    [user, refresh],
  );

  return { journals, loading, saving, savedAt, refresh, create, save, remove, duplicate };
}
