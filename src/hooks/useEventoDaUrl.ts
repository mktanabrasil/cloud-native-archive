import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { AppEvent } from '@/types';

/**
 * Abre o evento pedido na URL (`?evento=<id>`) assim que a lista chega
 * (13/11/2026). É o botão "Abrir e ajustar o evento" do e-mail de devolução:
 * a gestora cai na Visão Geral já com o evento no formulário. O parâmetro sai
 * da URL depois de usado, para um F5 não reabrir.
 */
export function useEventoDaUrl(eventos: AppEvent[], carregando: boolean, abrir: (evento: AppEvent) => void) {
  const [params, setParams] = useSearchParams();
  const id = params.get('evento');
  useEffect(() => {
    if (!id || carregando) return;
    const alvo = eventos.find(e => e.id === id);
    const sem = new URLSearchParams(params);
    sem.delete('evento');
    setParams(sem, { replace: true });
    if (alvo) abrir(alvo);
    else toast.error('Não encontrei este evento', { description: 'Ele pode ter sido apagado, ou não é da sua unidade.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, carregando, eventos]);
}
