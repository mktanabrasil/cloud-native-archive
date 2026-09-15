import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, ExternalLink, Lock, RefreshCw, Upload, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { contagemDaAgenda, textoDaCarga } from '@/lib/events/agenda';
import { toast } from 'sonner';

interface AgendaGoogle { chave: 'equipe'; calendar_id: string; nome: string; compartilhada_com: string[] }
interface Estado { so_equipe: boolean; chave_configurada: boolean; agendas: AgendaGoogle[] }

const linkDaAgenda = (id: string) => `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(id)}`;
const linkDeInscricao = (id: string) => `https://calendar.google.com/calendar/u/0?cid=${encodeURIComponent(id)}`;

/**
 * Card "Agenda do Google" do Painel (só admin geral): a agenda que o robô
 * criou (só "ANA · Eventos": a pública foi descartada em 15/09), quem lê hoje, a contagem do que está e do que falta, e o botão
 * da carga inicial — que enfileira todo confirmado ainda fora do Google, sem
 * mandar e-mail de novo. Mockup aprovado em 15/09/2026.
 */
export function AgendaDoGoogle() {
  const { events, refetchEvents } = useApp();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erroDeLeitura, setErroDeLeitura] = useState<string | null>(null);
  const [comErro, setComErro] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const ler = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('eventos-aviso', { body: { estado: true } });
    const resposta = data as (Partial<Estado> & { error?: string }) | null;
    if (error || !resposta || resposta.error) { setErroDeLeitura(error?.message || resposta?.error || 'sem resposta'); return; }
    // Função de versão anterior responde sem `agendas`: avisa em vez de quebrar.
    if (!Array.isArray(resposta.agendas)) { setErroDeLeitura('a função publicada ainda não conhece a consulta de estado'); return; }
    setErroDeLeitura(null);
    setEstado({ so_equipe: !!resposta.so_equipe, chave_configurada: !!resposta.chave_configurada, agendas: resposta.agendas.filter(a => a.chave === 'equipe') });
    const { count } = await supabase.from('avisos_de_evento').select('id', { count: 'exact', head: true }).eq('agenda_status', 'falhou');
    setComErro(count || 0);
  }, []);

  useEffect(() => { void ler(); }, [ler]);

  const contagem = contagemDaAgenda(events, comErro);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase.functions.invoke('eventos-aviso', { body: { carga: true } });
      if (error || (data as { error?: string })?.error) throw new Error(error?.message || (data as { error?: string }).error);
      toast.success('Carga inicial concluída', { description: 'Os confirmados foram enviados para a agenda. Confira cada um no painel de detalhe.' });
    } catch (e) {
      toast.error('A carga inicial não terminou', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCarregando(false);
      await Promise.all([refetchEvents(), ler()]);
    }
  };

  const copiar = async (texto: string, chave: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(chave); setTimeout(() => setCopiado(null), 1500); }
    catch { toast.error('Não consegui copiar. Selecione e copie o link manualmente.'); }
  };

  return (
    <Card data-testid="agenda-do-google">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarCheck className="h-5 w-5 text-primary" /> Agenda do Google
          </CardTitle>
          <p className="max-w-[56ch] text-sm text-muted-foreground">Eventos confirmados entram sozinhos na agenda abaixo, só da equipe. Edite sempre no app: o Google é só leitura.</p>
        </div>
        <Button className="gap-2" disabled={carregando || contagem.faltam === 0 || !estado?.chave_configurada} onClick={carregar}>
          {carregando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {carregando ? 'Enviando para a agenda…' : textoDaCarga(contagem.faltam)}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {erroDeLeitura && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground">
            Não consegui falar com a função de avisos agora ({erroDeLeitura}). <button className="underline" onClick={() => void ler()}>Tentar de novo</button>
          </p>
        )}

        {estado && !estado.chave_configurada && (
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">A chave do robô (GOOGLE_SA_KEY) não está no servidor: os eventos não vão para o Google até ela ser configurada.</p>
        )}

        {estado?.so_equipe && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-warning/60 bg-warning/10 p-3 text-xs" data-testid="modo-pre-lancamento">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p><b>Modo pré-lançamento ligado.</b> Só mkt@, contato@, parceiros@ e eventos@ recebem e-mails e leem as agendas. A gestão das unidades entra quando a chave <code className="rounded bg-muted px-1">AVISOS_SO_EQUIPE</code> for removida no Coolify.</p>
          </div>
        )}

        {estado && estado.agendas.length > 0 && (
          <div className="grid gap-3">
            {estado.agendas.map(a => (
              <div key={a.chave} className="space-y-1.5 rounded-lg border border-border p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  {a.nome}
                  <Badge variant="secondary" className="ml-auto text-[10px]">equipe</Badge>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {`Lida por ${a.compartilhada_com.length} ${a.compartilhada_com.length === 1 ? 'endereço' : 'endereços'}: ${a.compartilhada_com.map(e => e.replace(/@anabrasil\.org$/, '@')).join(', ')}`}
                </p>
                <p className="flex flex-wrap gap-3 text-xs">
                  <a href={linkDaAgenda(a.calendar_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"><ExternalLink className="h-3 w-3" /> Abrir no Google</a>
                  <button type="button" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2" onClick={() => copiar(linkDeInscricao(a.calendar_id), a.chave)}>
                    {copiado === a.chave ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copiar link de inscrição
                  </button>
                </p>
              </div>
            ))}
          </div>
        )}

        {estado && estado.agendas.length === 0 && estado.chave_configurada && (
          <p className="text-xs text-muted-foreground">A agenda ainda não foi criada: ela nasce na primeira vez que um evento confirmado passa pela função.</p>
        )}

        <dl className="flex flex-wrap gap-6 tabular-nums" data-testid="contagem-da-agenda">
          {[
            ['confirmados no app', contagem.confirmados],
            ['já na agenda', contagem.naAgenda],
            ['faltam', contagem.faltam],
            ['com erro', contagem.comErro],
          ].map(([rotulo, n]) => (
            <div key={rotulo as string}>
              <dt className="order-2 text-[11px] text-muted-foreground">{rotulo}</dt>
              <dd className="text-xl font-semibold leading-tight">{n}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
