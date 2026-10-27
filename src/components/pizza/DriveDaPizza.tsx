import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { chamarDrive, type EstadoDoDrive } from '@/lib/pizza/api';

/**
 * A cópia para o Google Drive (parte 2, 07/10/2026), dentro do painel da
 * Pizza da Alegria: conectar a conta Google (comunicação/admin), ver a pasta,
 * quantas faltam copiar e "Copiar pendentes agora". O Google devolve para a
 * raiz do site, que repassa para /pizza-da-alegria/painel com ?code=&state=.
 */
export function DriveDaPizza() {
  const [params, setParams] = useSearchParams();
  const [estado, setEstado] = useState<EstadoDoDrive | null>(null);
  const [ocupado, setOcupado] = useState<null | 'conectar' | 'copiar' | 'desconectar'>(null);
  const [falha, setFalha] = useState<string | null>(null);

  const ler = useCallback(async () => {
    try { setEstado(await chamarDrive<EstadoDoDrive>({ estado: true })); setFalha(null); }
    catch (e) { setFalha(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void ler(); }, [ler]);

  // Voltando do Google com ?code=&state=drive:…
  useEffect(() => {
    const code = params.get('code'), state = params.get('state');
    if (!code || !state?.startsWith('drive:')) return;
    const p = new URLSearchParams(params);
    ['code', 'state', 'scope', 'authuser', 'prompt', 'hd'].forEach((k) => p.delete(k));
    setParams(p, { replace: true });
    (async () => {
      setOcupado('conectar');
      try {
        const r = await chamarDrive<{ google_email: string }>({ oauth_code: code, state });
        toast.success('Google Drive conectado', { description: `Copiando como ${r.google_email}, na pasta Pizza da Alegria 2026.` });
        await chamarDrive({ sincronizar: true }).catch(() => null);
        await ler();
      } catch (e) {
        toast.error('A conexão com o Drive não terminou', { description: e instanceof Error ? e.message : String(e) });
      } finally { setOcupado(null); }
    })();
  }, [params, setParams, ler]);

  async function conectar() {
    setOcupado('conectar');
    try { const r = await chamarDrive<{ url: string }>({ oauth_url: true }); window.location.href = r.url; }
    catch (e) { toast.error('Não consegui começar a conexão', { description: e instanceof Error ? e.message : String(e) }); setOcupado(null); }
  }

  async function copiar() {
    setOcupado('copiar');
    try {
      const r = await chamarDrive<{ copiadas: number; falharam: number; pendentes: number }>({ sincronizar: true });
      if (r.falharam) toast.error(`${r.falharam} não ${r.falharam === 1 ? 'foi copiada' : 'foram copiadas'}`, { description: 'Veja o motivo abaixo e tente de novo.' });
      else toast.success(r.copiadas ? `${r.copiadas} ${r.copiadas === 1 ? 'confirmação copiada' : 'confirmações copiadas'} para o Drive` : 'Nada pendente');
      await ler();
    } catch (e) { toast.error('A cópia não terminou', { description: e instanceof Error ? e.message : String(e) }); }
    finally { setOcupado(null); }
  }

  async function desconectar() {
    setOcupado('desconectar');
    try { await chamarDrive({ desconectar: true }); await ler(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(null); }
  }

  const c = estado?.conexao;
  return (
    <section aria-label="Google Drive" className="flex flex-col gap-3 rounded-[20px] border border-black/5 bg-card px-4 py-3.5 dark:border-white/5" data-testid="drive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <b className="text-[15px] font-semibold">Google Drive · Setor Marketing</b>
            {/* Esboço V2: a situação em texto com bolinha, no lugar do ícone */}
            {estado && !falha && (
              <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold ${c && !c.erro ? 'text-success' : 'text-warning'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />{c ? (c.erro ? 'Com erro' : 'Conectado') : 'Não conectado'}
              </span>
            )}
          </div>
          <span className="block text-[13px] text-muted-foreground sm:truncate">
            {falha ? `Não consegui ler o estado: ${falha}` : !estado ? 'Conferindo…' : c ? `Copiando como ${c.google_email} · ${estado.pendentes ? `${estado.pendentes} para copiar` : 'tudo copiado'}` : 'Ainda não conectado: as confirmações ficam guardadas no app e vão para o Drive quando conectar.'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {c && <Button asChild variant="outline" size="sm"><a href={c.pasta_link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Abrir a pasta</a></Button>}
          {c && <Button variant="outline" size="sm" disabled={ocupado !== null} onClick={copiar}>{ocupado === 'copiar' ? 'Copiando…' : 'Copiar pendentes agora'}</Button>}
          {estado?.pode_conectar && !c && <Button variant="outline" size="sm" disabled={ocupado !== null || !estado.oauth_configurado} onClick={conectar}>{ocupado === 'conectar' ? 'Conectando…' : 'Conectar Google Drive'}</Button>}
          {estado?.pode_conectar && c && <Button variant="ghost" size="sm" disabled={ocupado !== null} onClick={desconectar}>Desconectar</Button>}
        </div>
      </div>
      {c?.erro && <p role="alert" className="text-[13px] font-semibold text-warning">{c.erro}</p>}
      {!!estado?.com_erro && <p className="text-[13px] text-destructive">{estado.com_erro} {estado.com_erro === 1 ? 'confirmação deu erro' : 'confirmações deram erro'} ao copiar. Toque em “Copiar pendentes agora” para tentar de novo.</p>}
      {estado && !c && !estado.pode_conectar && <p className="text-xs text-muted-foreground">Quem conecta é a comunicação, com a conta mkt@anabrasil.org.</p>}
    </section>
  );
}
