import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * Salvar sozinho (23/11/2026, Calendário Anual): grava um pouco depois que a
 * pessoa para de digitar, na hora ao sair da parte (ou esconder a aba) e
 * avisa antes de fechar a página com algo ainda não gravado.
 *
 * - `chave`: muda a cada alteração na tela (o relógio recomeça).
 * - `mudou`: há algo diferente do que está no banco.
 * - `salvar`: grava (lê o que está na tela na hora; pode lançar erro).
 * - `pronto`: dá para gravar agora (ex.: a folha precisa de título).
 *
 * Falhou: mostra o erro uma vez e tenta de novo sozinho em 8 s.
 */
export type EstadoDoSalvamento = 'salvo' | 'esperando' | 'salvando' | 'erro';

export function useSalvarSozinho({ chave, mudou, salvar, ativo = true, pronto = true, espera = 1500 }: {
  chave: string;
  mudou: boolean;
  salvar: () => Promise<void>;
  ativo?: boolean;
  pronto?: boolean;
  espera?: number;
}): { estado: EstadoDoSalvamento; salvarAgora: () => void } {
  const [estado, setEstado] = useState<EstadoDoSalvamento>('salvo');
  // Muda depois de cada gravação: a tela confere de novo se ainda há o que gravar.
  const [rodada, setRodada] = useState(0);
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;
  const pendente = useRef(false);
  pendente.current = ativo && mudou && pronto;
  const indo = useRef<Promise<void> | null>(null);
  const relogio = useRef<number>();
  const vivo = useRef(true);
  const avisouErro = useRef(false);
  const chaveAgora = useRef(chave);
  chaveAgora.current = chave;

  const rodar = useCallback(async () => {
    window.clearTimeout(relogio.current);
    if (indo.current) await indo.current;
    if (!pendente.current) { if (vivo.current) setEstado('salvo'); return; }
    if (vivo.current) setEstado('salvando');
    const chaveDoEnvio = chaveAgora.current;
    const p = salvarRef.current();
    indo.current = p.then(() => undefined, () => undefined);
    try {
      await p;
      avisouErro.current = false;
      // Só confere de novo se a pessoa mexeu durante o salvamento: o mesmo
      // conteúdo nunca é gravado duas vezes seguidas (sem laço).
      if (vivo.current) { setEstado('salvo'); if (chaveAgora.current !== chaveDoEnvio) setRodada(r => r + 1); }
    } catch (e) {
      if (!vivo.current) return;
      setEstado('erro');
      if (!avisouErro.current) {
        avisouErro.current = true;
        toast.error('Não foi possível salvar', { description: `${(e as Error).message || 'Sem conexão?'} Tentamos de novo sozinhos.` });
      }
      relogio.current = window.setTimeout(() => void rodar(), 8000);
    } finally {
      indo.current = null;
    }
  }, []);

  // Cada alteração recomeça o relógio.
  useEffect(() => {
    if (!ativo || !mudou || !pronto) {
      setEstado(e => (e === 'esperando' ? 'salvo' : e));
      return;
    }
    setEstado(e => (e === 'salvando' || e === 'erro' ? e : 'esperando'));
    window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => void rodar(), espera);
    return () => window.clearTimeout(relogio.current);
  }, [chave, mudou, ativo, pronto, espera, rodada, rodar]);

  // Esconder a aba (trocar de app no celular) grava na hora; fechar com algo pendente avisa.
  useEffect(() => {
    const escondeu = () => { if (document.visibilityState === 'hidden' && pendente.current) void rodar(); };
    const sair = (e: BeforeUnloadEvent) => {
      if (pendente.current || indo.current) { void rodar(); e.preventDefault(); e.returnValue = ''; }
    };
    document.addEventListener('visibilitychange', escondeu);
    window.addEventListener('beforeunload', sair);
    return () => { document.removeEventListener('visibilitychange', escondeu); window.removeEventListener('beforeunload', sair); };
  }, [rodar]);

  // Saiu da parte (voltou ao início, trocou de mês): grava o que faltava.
  useEffect(() => {
    vivo.current = true;
    return () => {
    vivo.current = false;
    window.clearTimeout(relogio.current);
    if (pendente.current) {
      const salvar = salvarRef.current, antes = indo.current;
      // Espera o salvamento que estava indo: a versão mais nova chega por último.
      void (async () => { if (antes) await antes; await salvar(); })().catch(() => toast.error('Não foi possível salvar a última alteração'));
    }
    };
  }, []);

  return { estado, salvarAgora: () => void rodar() };
}

/** O texto do botão de cada estado. */
export const rotuloDoSalvamento = (e: EstadoDoSalvamento) =>
  e === 'salvando' ? 'Salvando…' : e === 'esperando' ? 'Salvar agora' : e === 'erro' ? 'Tentar de novo' : 'Tudo salvo';
