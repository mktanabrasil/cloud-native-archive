import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Copy, ExternalLink, Globe, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { ENDERECO_DA_API, atualizarSiteAgora, estadoDoSite, type EstadoDoSite } from '@/lib/transparencia/api';
import { PreviaDoSite } from './PreviaDoSite';

/**
 * O Portal Transparência no site do ANA (API pública, 24/11/2026): o cartão
 * "No site do ANA" e a linha de situação de cada unidade. Só lê a situação; o
 * único botão que mexe é o "Atualizar agora" (com confirmação).
 */

const doisDigitos = (n: number) => String(n).padStart(2, '0');
/** "às 16:44" (hoje) ou "em 23/11 às 16:44". */
export function quando(iso: string | null, agora = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  const hora = `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
  return d.toDateString() === agora.toDateString() ? `às ${hora}` : `em ${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} às ${hora}`;
}
/** "há 1 min", "agora há pouco", "há 2 h". */
export function haQuanto(iso: string | null, agora = new Date()): string {
  if (!iso) return '';
  const min = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`;
}

export type Tom = 'ok' | 'alerta';
const semPreposicao = (s: string) => s.replace(/^às |^em /, '');
/** A situação geral do site a partir do estado da API. */
export function situacaoGeral(e: EstadoDoSite, agora = new Date()): { tom: Tom; titulo: string; detalhe: string | null } {
  const ultima = e.unidades.map((u) => u.atualizado_em).filter(Boolean).sort().at(-1) ?? null;
  const listaBoa = `o site mostra a última lista boa${ultima ? ` (${semPreposicao(quando(ultima, agora))})` : ''}`;
  if (!e.ciclo_em) return { tom: 'alerta', titulo: 'A conferência automática do Drive ainda não rodou', detalhe: null };
  if (e.alerta_em) {
    // O aviso sai depois de 30 min de falha (na hora, se a conta caiu): mostra quando avisou, não "desde".
    const deUnidades = /unidade\(s\) sem conseguir atualizar/.test(e.alerta_motivo ?? '');
    return {
      tom: 'alerta',
      titulo: `${deUnidades ? 'Há unidades sem atualizar' : 'A atualização parou'} · aviso enviado ${quando(e.alerta_em, agora)} · ${listaBoa}`,
      detalhe: e.alerta_motivo,
    };
  }
  if (e.ciclo_erro) return { tom: 'alerta', titulo: `A última conferência do Drive falhou (${haQuanto(e.ciclo_em, agora)}) · ${listaBoa}`, detalhe: e.ciclo_erro };
  // Ciclo parado há mais de 10 min (o agendamento roda a cada 2).
  if (agora.getTime() - new Date(e.ciclo_em).getTime() > 10 * 60_000) {
    return { tom: 'alerta', titulo: `A conferência do Drive não roda desde ${semPreposicao(quando(e.ciclo_em, agora))} · ${listaBoa}`, detalhe: null };
  }
  return { tom: 'ok', titulo: `No ar · Drive conferido ${haQuanto(e.ciclo_em, agora)}`, detalhe: null };
}

/** Unidades na fila para reler que ainda não falharam (as que falham aparecem na própria linha). */
export const unidadesAtualizando = (e: EstadoDoSite) => e.situacao.filter((x) => x.sujo && !x.erro).length;

/** A linha de uma unidade no cartão dela. */
export function linhaDaUnidade(e: EstadoDoSite, configId: string, slug: string | null | undefined, agora = new Date()): { tom: Tom | 'neutro'; destaque?: string; texto: string } | null {
  const s = e.situacao.find((x) => x.config_id === configId);
  const u = slug ? e.unidades.find((x) => x.slug === slug) : undefined;
  if (s?.erro) {
    return { tom: 'alerta', texto: `Não atualiza: ${s.erro.replace(/\.$/, '')}. ${u?.atualizado_em ? `O site mostra a lista lida ${quando(u.atualizado_em, agora)}.` : 'Ainda não aparece no site.'}` };
  }
  if (u) return { tom: 'neutro', destaque: `${u.documentos.toLocaleString('pt-BR')} documento${u.documentos === 1 ? '' : 's'}`, texto: ` · lista lida ${quando(u.atualizado_em, agora)}${s?.sujo ? ' · atualizando…' : ''}` };
  if (s) return { tom: 'neutro', texto: 'Ainda não aparece no site: a primeira leitura sai em poucos minutos.' };
  return null;
}

/**
 * Carrega a situação do site e recarrega a cada minuto enquanto a tela está
 * aberta. O relógio também anda a cada minuto ("há X min" não congela). Sem
 * permissão (403), para de perguntar.
 */
export function useEstadoDoSite(ativo: boolean) {
  const [estado, setEstado] = useState<EstadoDoSite | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [, setRelogio] = useState(0);
  const emAndamento = useRef(false);
  const semPermissao = useRef(false);
  const recarregar = useCallback(async () => {
    if (emAndamento.current || semPermissao.current) return;
    emAndamento.current = true;
    try { setEstado(await estadoDoSite()); setFalhou(false); }
    catch (e) { setFalhou(true); if (/Só quem cuida/.test((e as Error).message)) semPermissao.current = true; }
    finally { emAndamento.current = false; }
  }, []);
  useEffect(() => {
    if (!ativo) return;
    void recarregar();
    const t = setInterval(() => { setRelogio((n) => n + 1); void recarregar(); }, 60_000);
    return () => clearInterval(t);
  }, [ativo, recarregar]);
  return { estado, falhou, recarregar };
}

type Situacao = ReturnType<typeof useEstadoDoSite>;

export function CartaoDoSite({ s }: { s: Situacao }) {
  const { estado, falhou, recarregar } = s;
  const [confirmar, setConfirmar] = useState(false);
  const [previa, setPrevia] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const acompanhando = useRef<ReturnType<typeof setInterval> | null>(null);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; if (acompanhando.current) clearInterval(acompanhando.current); }; }, []);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(estado?.base ?? ENDERECO_DA_API); toast.success('Endereço da API copiado'); }
    catch { toast.error('Não foi possível copiar', { description: estado?.base ?? ENDERECO_DA_API }); }
  };
  const atualizar = async () => {
    setConfirmar(false);
    setAtualizando(true);
    try {
      const r = await atualizarSiteAgora();
      if (r.ocupado) toast.info('Uma conferência automática está rodando agora. Tente de novo em 1 minuto.');
      else if (r.erro) toast.error('Não foi possível atualizar', { description: r.erro });
      else if (r.falhas?.length) toast.warning(`${r.lidas?.length ?? 0} unidade(s) relidas; ${r.falhas.length} não conseguiram`, { description: r.falhas.slice(0, 3).join(' · ') });
      else toast.success(r.pendentes ? `${r.lidas?.length ?? 0} unidade(s) relidas; as outras ${r.pendentes} terminam nos próximos minutos` : `${r.lidas?.length ?? 0} unidade(s) relidas`);
      // Uma queda grande só é aceita pelo botão: unidade que ficou para depois precisa de um novo clique.
      if (r.pendentes) toast.info('Se você tirou muitos documentos de uma unidade, aperte "Atualizar agora" de novo quando o cartão terminar.', { duration: 8000 });
    } catch (e) {
      toast.error('Não foi possível atualizar', { description: (e as Error).message });
    } finally {
      if (montado.current) {
        setAtualizando(false);
        await recarregar();
        // Acompanha as unidades que ficaram para os próximos ciclos (a cada 10 s, até 6 min ou até acabar).
        if (acompanhando.current) clearInterval(acompanhando.current);
        let voltas = 0;
        acompanhando.current = setInterval(() => {
          voltas++;
          if (!montado.current || voltas > 36) { if (acompanhando.current) clearInterval(acompanhando.current); return; }
          void recarregar();
        }, 10_000);
      }
    }
  };

  const geral = estado ? situacaoGeral(estado) : null;
  const documentos = estado?.unidades.reduce((t, u) => t + u.documentos, 0) ?? 0;
  const faltam = estado ? unidadesAtualizando(estado) : 0;
  // Acabou a fila: para o acompanhamento rápido.
  useEffect(() => { if (estado && faltam === 0 && acompanhando.current) { clearInterval(acompanhando.current); acompanhando.current = null; } }, [estado, faltam]);
  const alerta = geral?.tom === 'alerta';

  return (
    <section className={cn('space-y-3 rounded-[20px] border bg-card p-4', alerta ? 'border-warning/60' : 'border-black/5 dark:border-white/5')} aria-label="No site do ANA">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-primary/25"><Globe className="h-5 w-5" /></span>
          <div className="min-w-0" aria-live="polite">
            <b className="block text-[15px]">No site do ANA</b>
            {!estado && !falhou && <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Carregando a situação…</span>}
            {!estado && falhou && <span className="text-[13px] text-muted-foreground">Não foi possível ver a situação agora. Tente de novo em instantes.</span>}
            {geral && (
              <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-semibold', alerta ? 'text-warning' : 'text-success')}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{geral.titulo}
              </span>
            )}
            {estado && falhou && <span className="block text-[12.5px] text-muted-foreground">Não consegui conferir agora; esta é a última situação vista.</span>}
            {estado && (
              <p className="text-[12.5px] text-muted-foreground">
                {estado.unidades.length} unidade{estado.unidades.length === 1 ? '' : 's'} · {documentos.toLocaleString('pt-BR')} documentos · confere o Drive a cada 2 minutos
                {faltam > 0 && <> · <b className="text-foreground">atualizando {faltam} unidade{faltam === 1 ? '' : 's'}…</b></>}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-10 gap-1.5" onClick={() => void copiar()}><Copy className="h-4 w-4" />Copiar endereço da API</Button>
          <Button variant="outline" size="sm" className="h-10 gap-1.5" onClick={() => setPrevia(true)}><ExternalLink className="h-4 w-4" />Ver o que o site recebe</Button>
          <Button size="sm" className="h-10 gap-1.5" onClick={() => setConfirmar(true)} disabled={atualizando}>
            {atualizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Atualizar agora
          </Button>
        </div>
      </div>
      {alerta && geral?.detalhe && (
        <div className="flex gap-2.5 rounded-[14px] bg-warning/10 p-3 text-[13px]" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <b>{geral.detalhe}</b> Enquanto isso, o site continua com a última lista boa e os documentos abrem normalmente.
            {estado?.alerta_em && <> O aviso foi para o WhatsApp da MKT e para o e-mail {quando(estado.alerta_em)}.</>}
          </div>
        </div>
      )}

      <PreviaDoSite aberta={previa} onOpenChange={setPrevia} base={estado?.base ?? ENDERECO_DA_API} />

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar a lista do site agora?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Relê as unidades no Drive. Leva de 1 a 3 minutos, e este cartão vai mostrando o andamento.</p>
                <p>Use também quando você <b className="text-foreground">tirou muitos documentos de propósito</b>: sozinha, a atualização não aceita uma lista com menos da metade dos documentos, para evitar que um engano no Drive (como uma pasta na lixeira) esvazie o site.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void atualizar()}>Atualizar agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** A linha "No site: …" de uma unidade. */
export function SituacaoNoSite({ s, configId, slug }: { s: Situacao; configId: string; slug?: string | null }) {
  if (!s.estado) return null;
  const l = linhaDaUnidade(s.estado, configId, slug);
  if (!l) return null;
  return l.tom === 'alerta' ? (
    <p className="mt-0.5 flex items-start gap-1.5 text-[12.5px] font-medium text-warning" data-testid="situacao-no-site"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{l.texto}</p>
  ) : (
    <p className="mt-0.5 text-[12.5px] text-muted-foreground" data-testid="situacao-no-site">{l.destaque ? <>No site: <b className="text-foreground">{l.destaque}</b>{l.texto}</> : l.texto}</p>
  );
}
