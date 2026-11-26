import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy, EyeOff, Loader2, Lock, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { quando } from '@/components/transparencia/NoSite';
import { estadoDaOuvidoria, reenviarOuvidoria, type EstadoDaOuvidoria } from '@/lib/ouvidoria/api';
import { NOME_DO_TIPO } from '../../../supabase/functions/ouvidoria/regras.ts';

/**
 * Administração › Ouvidoria (26/11/2026, mockup aprovado): só o cartão da
 * ligação com o site. As mensagens chegam por e-mail na ouvidoria (cópia para
 * a administração) e ficam guardadas como garantia; o app nunca as mostra.
 */

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** A situação no topo do cartão. */
export function situacao(e: EstadoDaOuvidoria, agora = new Date()): { tom: 'ok' | 'alerta'; texto: string } {
  if (e.pendentes.length) {
    const n = e.pendentes.length;
    return { tom: 'alerta', texto: `${n} ${plural(n, 'e-mail não saiu', 'e-mails não saíram')} · tentando de novo` };
  }
  if (e.ultimo_envio) return { tom: 'ok', texto: `No ar · último envio ${quando(e.ultimo_envio, agora)}` };
  return { tom: 'ok', texto: 'No ar · nenhuma mensagem ainda' };
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-border/60 py-3 text-[13.5px] sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <span className="text-[12.5px] font-semibold text-muted-foreground">{rotulo}</span>
      <div className="min-w-0 text-foreground">{children}</div>
    </div>
  );
}

export function OuvidoriaNoSite() {
  const [e, setE] = useState<EstadoDaOuvidoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    try { setE(await estadoDaOuvidoria()); setErro(null); } catch (x) { setErro(x instanceof Error ? x.message : String(x)); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  async function copiar() {
    if (!e) return;
    try { await navigator.clipboard.writeText(e.endereco); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { toast.error('Não consegui copiar. Selecione o endereço e copie à mão.'); }
  }
  async function reenviar() {
    setReenviando(true);
    try {
      const r = await reenviarOuvidoria();
      setE(r);
      if (r.pendentes.length) toast.error(`${r.enviados ? `${r.enviados} ${plural(r.enviados, 'saiu', 'saíram')}; ` : ''}${r.pendentes.length} ainda não ${plural(r.pendentes.length, 'saiu', 'saíram')}. O app segue tentando a cada 5 minutos.`);
      else toast.success(r.enviados ? `${plural(r.enviados, 'E-mail enviado', `${r.enviados} e-mails enviados`)} para a ouvidoria.` : 'Nada pendente.');
    } catch (x) { toast.error(x instanceof Error ? x.message : String(x)); }
    finally { setReenviando(false); }
  }

  if (erro && !e) {
    return (
      <div className="max-w-[860px] space-y-2 rounded-[20px] border border-destructive/40 bg-destructive/10 p-4 text-[13.5px] text-destructive">
        <p>Não consegui abrir a situação da Ouvidoria: {erro}</p>
        <Button size="sm" variant="outline" onClick={() => void carregar()} className="gap-1.5"><RefreshCw className="h-4 w-4" />Tentar de novo</Button>
      </div>
    );
  }
  if (!e) return <p className="flex items-center gap-2 py-6 text-[14px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Abrindo…</p>;

  const s = situacao(e);
  return (
    <section aria-label="Ouvidoria no site" className="max-w-[860px] rounded-[20px] border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#81e2cf] text-[#1f2322]"><Mail className="h-[18px] w-[18px]" /></span>
        <b className="text-[16px] text-foreground">Ouvidoria no site</b>
        <span role="status" className={cn('ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold',
          s.tom === 'alerta' ? 'bg-destructive/10 text-destructive' : 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]')}>
          {s.tom === 'alerta' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{s.texto}
        </span>
      </div>

      {e.pendentes.length > 0 && (
        <div className="mb-3 space-y-2 rounded-[14px] border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-foreground">
          <ul className="space-y-1.5">
            {e.pendentes.map((p) => (
              <li key={p.protocolo}>
                <b className="font-mono">{p.protocolo}</b> ({NOME_DO_TIPO[p.tipo] ?? p.tipo}, {quando(p.criado_em)}) foi guardada, mas o e-mail ainda não saiu
                {p.ultimo_erro ? <span className="text-muted-foreground">: {p.ultimo_erro}</span> : null}.
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">O app tenta de novo a cada 5 minutos e avisa no WhatsApp da MKT se passar de 15 minutos.</span>
            <Button size="sm" variant="outline" onClick={() => void reenviar()} disabled={reenviando} className="gap-1.5">
              {reenviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Reenviar agora
            </Button>
          </div>
        </div>
      )}

      <Linha rotulo="Endereço da API">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-[10px] bg-muted/60 px-3 py-2 text-[12.5px]" title={e.endereco}>{e.endereco}</code>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void copiar()}>
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">É o que o dev do site põe no <code>data-endpoint</code> do formulário. Responde com o número de protocolo.</p>
      </Linha>
      <Linha rotulo="Para onde vai">{e.para}{e.copia.length ? ` · cópia para ${e.copia.join(', ')}` : ''}</Linha>
      <Linha rotulo="Recebidas">
        Este mês: <b>{e.mes}</b>{e.ultima ? <> · último protocolo <span className="font-mono">{e.ultima.protocolo}</span> ({quando(e.ultima.criado_em)})</> : null}
      </Linha>
      <Linha rotulo="Anonimato">
        <span className="flex items-center gap-1.5"><Lock className="h-4 w-4 shrink-0 text-muted-foreground" />Quem não se identifica: guardamos só o tipo, a mensagem e a hora. Sem IP.</span>
      </Linha>
      <p className="flex items-center gap-1.5 border-t border-border/60 pt-3 text-[12.5px] text-muted-foreground">
        <EyeOff className="h-4 w-4 shrink-0" />As mensagens não aparecem aqui: ficam guardadas como garantia e chegam só no e-mail da ouvidoria.
      </p>
    </section>
  );
}
