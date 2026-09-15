import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AvisoDeEvento } from '@/lib/events/avisos';

/**
 * Os avisos por e-mail de um evento, para o painel de detalhe.
 *
 * Lê a fila `avisos_de_evento` (o gatilho do banco enfileira; a função
 * `eventos-aviso` envia) e expõe "reenviar", que chama a função com o id
 * do aviso — ela processa esse e qualquer outro pendente.
 */
export function useAvisosDoEvento(eventId: string | null | undefined) {
  const [avisos, setAvisos] = useState<AvisoDeEvento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  const carregar = useCallback(async () => {
    if (!eventId) { setAvisos([]); return; }
    setCarregando(true);
    const { data, error } = await supabase
      .from('avisos_de_evento')
      .select('id, event_id, tipo, status, destinatarios, erro, tentativas, criado_em, enviado_em, agenda_status, agenda_erro, agenda_em, agenda_link')
      .eq('event_id', eventId)
      .order('criado_em', { ascending: false })
      .limit(5);
    if (!error && data) setAvisos(data as AvisoDeEvento[]);
    setCarregando(false);
  }, [eventId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const reenviar = useCallback(async (avisoId: string) => {
    setReenviando(true);
    try {
      await supabase.functions.invoke('eventos-aviso', { body: { aviso_id: avisoId } });
    } finally {
      setReenviando(false);
      await carregar();
    }
  }, [carregar]);

  return { avisos, ultimo: avisos[0] ?? null, carregando, reenviando, reenviar, recarregar: carregar };
}

/**
 * Cutuca a função para processar o que estiver pendente. Chamado pelo app
 * depois de salvar: se o disparo direto do banco (pg_net) não estiver
 * configurado, é isto que entrega o e-mail. Erros ficam no console — a fila
 * guarda o aviso, e o painel mostra "Reenviar".
 */
export async function processarAvisosPendentes(): Promise<void> {
  try {
    await supabase.functions.invoke('eventos-aviso', { body: {} });
  } catch (e) {
    console.warn('[avisos] não consegui chamar eventos-aviso agora:', e);
  }
}
