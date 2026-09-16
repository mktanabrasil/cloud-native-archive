import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, Check, ExternalLink, Lock, RefreshCw, Unplug, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { contagemDaAgenda, textoDaCarga } from '@/lib/events/agenda';
import { type EstadoDaAgenda, linkDaAgendaNoGoogle, retornoDoGoogle, situacaoDaConexao, textoDaTroca } from '@/lib/events/conexaoGoogle';
import { toast } from 'sonner';
import { AVISO_DE_SESSAO_EXPIRADA, tratarNaoAutorizado } from '@/lib/sessao';

interface AgendaDoGoogleLista { id: string; nome: string; cor: string | null; primaria: boolean; papel: string }

/** A função responde { error } com status 4xx/5xx; o cliente esconde o corpo atrás de "non-2xx". Aqui a mensagem real vem à frente. */
const chamar = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('eventos-aviso', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let detalhe = '';
    try { detalhe = ctx ? ((await ctx.clone().json()) as { error?: string }).error || '' : ''; } catch { /* sem corpo JSON */ }
    // Sessão morta no servidor: a pessoa vai para o login; aqui só não pintamos erro por cima.
    if (/não autorizado/i.test(detalhe) && await tratarNaoAutorizado()) throw new Error(AVISO_DE_SESSAO_EXPIRADA);
    throw new Error(detalhe || error.message || 'sem resposta');
  }
  const resposta = data as (T & { error?: string }) | null;
  if (!resposta) throw new Error('sem resposta');
  if (resposta.error) throw new Error(resposta.error);
  return resposta;
};

/**
 * Card "Agenda do Google" do Painel (só admin geral). Desde 16/09/2026 o app
 * escreve na agenda que a equipe já usa, em nome da eventos@: aqui se conecta
 * (uma vez), escolhe a agenda, vê o estado da conexão, e dispara a carga
 * inicial. Enquanto ninguém conectou, o robô continua valendo e o card diz.
 * Mockup aprovado em 16/09/2026.
 */
export function AgendaDoGoogle() {
  const { events, refetchEvents } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [estado, setEstado] = useState<EstadoDaAgenda | null>(null);
  const [erroDeLeitura, setErroDeLeitura] = useState<string | null>(null);
  const [comErro, setComErro] = useState(0);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [escolha, setEscolha] = useState<{ agendas: AgendaDoGoogleLista[]; marcada: AgendaDoGoogleLista | null } | null>(null);
  const [confirmarTroca, setConfirmarTroca] = useState<AgendaDoGoogleLista | null>(null);

  const ler = useCallback(async () => {
    try {
      const r = await chamar<Partial<EstadoDaAgenda>>({ estado: true });
      if (!Array.isArray(r.agendas)) throw new Error('a função publicada ainda não conhece a consulta de estado');
      setErroDeLeitura(null);
      setEstado({
        so_equipe: !!r.so_equipe, chave_configurada: !!r.chave_configurada, oauth_configurado: !!r.oauth_configurado,
        modo: r.modo || (r.chave_configurada ? 'robo' : 'nenhum'), conexao: r.conexao ?? null, agendas: r.agendas.filter(a => a.chave === 'equipe'),
      });
      const { count } = await supabase.from('avisos_de_evento').select('id', { count: 'exact', head: true }).eq('agenda_status', 'falhou');
      setComErro(count || 0);
    } catch (e) {
      setErroDeLeitura(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void ler(); }, [ler]);

  const abrirEscolha = useCallback(async () => {
    setOcupado('listar');
    try {
      const r = await chamar<{ agendas: AgendaDoGoogleLista[] }>({ listar_agendas: true });
      const recomendada = r.agendas.find(a => /eventos ana/i.test(a.nome)) || r.agendas.find(a => !a.primaria) || r.agendas[0] || null;
      setEscolha({ agendas: r.agendas, marcada: recomendada });
    } catch (e) {
      toast.error('Não consegui listar as agendas', { description: e instanceof Error ? e.message : String(e) });
    } finally { setOcupado(null); }
  }, []);

  // Voltando do Google: a raiz mandou para cá com ?code=&state=agenda:…
  useEffect(() => {
    const retorno = retornoDoGoogle(searchParams.toString() ? '?' + searchParams.toString() : '');
    if (!retorno) return;
    const params = new URLSearchParams(searchParams);
    params.delete('code'); params.delete('state'); params.delete('scope'); params.delete('authuser'); params.delete('prompt'); params.delete('hd');
    setSearchParams(params, { replace: true });
    (async () => {
      setOcupado('conectar');
      try {
        await chamar({ oauth_code: retorno.code, state: retorno.state });
        toast.success('Google Agenda conectado', { description: 'Agora escolha em qual agenda os eventos confirmados entram.' });
        await ler();
        await abrirEscolha();
      } catch (e) {
        toast.error('A conexão com o Google não terminou', { description: e instanceof Error ? e.message : String(e) });
      } finally { setOcupado(null); }
    })();
  }, [searchParams, setSearchParams, ler, abrirEscolha]);

  const conectar = async () => {
    setOcupado('conectar');
    try {
      const r = await chamar<{ url: string }>({ oauth_url: true });
      window.location.href = r.url;
    } catch (e) {
      toast.error('Não consegui começar a conexão', { description: e instanceof Error ? e.message : String(e) });
      setOcupado(null);
    }
  };

  const desconectar = async () => {
    if (!window.confirm('Desconectar o Google Agenda? Os eventos que já estão lá ficam; os próximos confirmados esperam na fila até reconectar.')) return;
    setOcupado('desconectar');
    try { await chamar({ desconectar: true }); toast.success('Google Agenda desconectado'); await ler(); }
    catch (e) { toast.error('Não consegui desconectar', { description: e instanceof Error ? e.message : String(e) }); }
    finally { setOcupado(null); }
  };

  const escolher = async (a: AgendaDoGoogleLista) => {
    setOcupado('escolher');
    setConfirmarTroca(null); setEscolha(null);
    try {
      await chamar({ escolher_agenda: { calendar_id: a.id, nome: a.nome } });
      toast.success(`Agenda "${a.nome}" em uso`, { description: 'Os confirmados foram enviados para lá. Confira cada um no painel de detalhe.' });
    } catch (e) {
      toast.error('A troca de agenda não terminou', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(null);
      await Promise.all([refetchEvents(), ler()]);
    }
  };

  const carregar = async () => {
    setOcupado('carga');
    try {
      await chamar({ carga: true });
      toast.success('Carga inicial concluída', { description: 'Os confirmados foram enviados para a agenda. Confira cada um no painel de detalhe.' });
    } catch (e) {
      toast.error('A carga inicial não terminou', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(null);
      await Promise.all([refetchEvents(), ler()]);
    }
  };

  const contagem = contagemDaAgenda(events, comErro);
  const situacao = estado ? situacaoDaConexao(estado) : null;
  const podeCarregar = !!estado && (estado.modo !== 'nenhum') && contagem.faltam > 0;
  const nomeDaAgenda = estado?.conexao?.calendar_nome || estado?.agendas[0]?.nome || 'a agenda';

  return (
    <Card data-testid="agenda-do-google">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarCheck className="h-5 w-5 text-primary" /> Agenda do Google
          </CardTitle>
          <p className="max-w-[56ch] text-sm text-muted-foreground">Eventos confirmados entram sozinhos na agenda abaixo. Edite sempre no app: mudanças feitas direto no Google não voltam para cá.</p>
        </div>
        <Button className="gap-2" disabled={!!ocupado || !podeCarregar} onClick={carregar}>
          {ocupado === 'carga' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {ocupado === 'carga' ? 'Enviando para a agenda…' : textoDaCarga(contagem.faltam)}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {erroDeLeitura && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground">
            Não consegui falar com a função de avisos agora ({erroDeLeitura}). <button className="underline" onClick={() => void ler()}>Tentar de novo</button>
          </p>
        )}

        {/* ----- a conexão ----- */}
        {estado && situacao === 'conectado' && estado.conexao && (
          <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/10 p-3 sm:flex-row sm:items-start" data-testid="conexao-google">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 space-y-0.5 text-xs">
              <p className="font-semibold text-foreground">Conectado como {estado.conexao.google_email}</p>
              <p className="text-muted-foreground">
                Conexão feita por {estado.conexao.conectado_por} em {new Date(estado.conexao.conectado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.
                Gravando em <b className="text-foreground">{estado.conexao.calendar_nome}</b>.
                {estado.conexao.calendar_id && <> <a href={linkDaAgendaNoGoogle(estado.conexao.calendar_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"><ExternalLink className="h-3 w-3" /> Abrir no Google</a></>}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={!!ocupado} onClick={abrirEscolha}>Trocar agenda</Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" disabled={!!ocupado} onClick={desconectar}><Unplug className="h-3.5 w-3.5" /> Desconectar</Button>
            </div>
          </div>
        )}

        {estado && situacao === 'sem_agenda' && estado.conexao && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center" data-testid="conexao-google">
            <div className="flex-1 text-xs">
              <p className="font-semibold text-foreground">Conectado como {estado.conexao.google_email}, falta escolher a agenda</p>
              <p className="text-muted-foreground">Até escolher, os eventos seguem para {estado.modo === 'robo' ? 'a agenda do robô' : 'a fila'}.</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" className="h-8 text-xs" disabled={!!ocupado} onClick={abrirEscolha}>{ocupado === 'listar' ? 'Buscando agendas…' : 'Escolher a agenda'}</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={!!ocupado} onClick={desconectar}>Desconectar</Button>
            </div>
          </div>
        )}

        {estado && situacao === 'perdida' && estado.conexao && (
          <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-start" data-testid="conexao-google">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-foreground">O Google desconectou {estado.conexao.google_email}</p>
              <p className="text-muted-foreground">{estado.conexao.erro} Os confirmados esperam na fila; nada se perde.</p>
            </div>
            <Button size="sm" className="h-8 shrink-0 text-xs" disabled={!!ocupado} onClick={conectar}>Reconectar</Button>
          </div>
        )}

        {estado && situacao === 'nao_conectado' && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center" data-testid="conexao-google">
            <div className="flex-1 text-xs">
              <p className="font-semibold text-foreground">Google Agenda não conectado</p>
              <p className="text-muted-foreground">
                {estado.modo === 'robo'
                  ? `Por enquanto os eventos vão para "${nomeDaAgenda}", a agenda do robô. Conecte como eventos@ para usar a agenda que a equipe já tem.`
                  : 'Os eventos confirmados ficam na fila até você conectar. Entre como eventos@ quando o Google pedir.'}
              </p>
              {!estado.oauth_configurado && <p className="mt-1 text-destructive">Faltam GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET no servidor.</p>}
            </div>
            <Button size="sm" className="h-8 shrink-0 gap-2 text-xs" disabled={!!ocupado || !estado.oauth_configurado} onClick={conectar}>
              {ocupado === 'conectar' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />} Conectar Google Agenda
            </Button>
          </div>
        )}

        {estado?.so_equipe && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-warning/60 bg-warning/10 p-3 text-xs" data-testid="modo-pre-lancamento">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              <b>Modo pré-lançamento ligado.</b> Só mkt@, contato@, parceiros@ e eventos@ recebem os e-mails.{' '}
              {estado.modo === 'conexao'
                ? <>Quem vê a agenda é definido por você no Google, no compartilhamento de "{nomeDaAgenda}".</>
                : <>A gestão das unidades entra quando você lançar, no card "Avisos por e-mail" abaixo.</>}
            </p>
          </div>
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

      {/* ----- escolher a agenda ----- */}
      <Dialog open={!!escolha} onOpenChange={o => { if (!o) setEscolha(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Em qual agenda os eventos confirmados entram?</DialogTitle>
            <DialogDescription>Só aparecem agendas em que {estado?.conexao?.google_email || 'a conta conectada'} pode criar eventos.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2" role="radiogroup" aria-label="Agendas disponíveis">
            {escolha?.agendas.length === 0 && <p className="text-sm text-muted-foreground">Essa conta não tem nenhuma agenda em que possa criar eventos. Desconecte e entre como eventos@.</p>}
            {escolha?.agendas.map(a => {
              const marcada = escolha.marcada?.id === a.id;
              return (
                <button key={a.id} type="button" role="radio" aria-checked={marcada}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left ${marcada ? 'border-primary bg-primary/10' : 'border-border'}`}
                  onClick={() => setEscolha({ ...escolha, marcada: a })}>
                  <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${marcada ? 'border-primary bg-primary' : 'border-border'}`} />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.cor || 'var(--border)' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.nome}</span>
                    <span className="block text-[11px] text-muted-foreground">{a.primaria ? 'agenda pessoal da conta' : a.papel === 'owner' ? 'a conta é dona' : 'compartilhada com edição'}</span>
                  </span>
                  {/eventos ana/i.test(a.nome) && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">recomendada</span>}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscolha(null)}>Cancelar</Button>
            <Button disabled={!escolha?.marcada} onClick={() => { const a = escolha?.marcada; if (!a) return; if (a.id === estado?.conexao?.calendar_id) { setEscolha(null); return; } setConfirmarTroca(a); }}>Usar esta agenda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- confirmar a troca ----- */}
      <Dialog open={!!confirmarTroca} onOpenChange={o => { if (!o) setConfirmarTroca(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{contagem.naAgenda > 0 ? `Mover ${contagem.naAgenda === 1 ? 'o evento' : `os ${contagem.naAgenda} eventos`} para "${confirmarTroca?.nome}"?` : `Usar "${confirmarTroca?.nome}"?`}</DialogTitle>
            <DialogDescription>
              {confirmarTroca && textoDaTroca(contagem.naAgenda, confirmarTroca.nome)}
              {contagem.naAgenda > 0 && estado?.modo === 'robo' && <> Quem via "ANA · Eventos" precisa ter acesso à agenda nova.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarTroca(null)}>Cancelar</Button>
            <Button disabled={!!ocupado} onClick={() => confirmarTroca && escolher(confirmarTroca)}>{contagem.naAgenda > 0 && estado?.modo === 'robo' ? 'Mover e apagar a antiga' : 'Usar esta agenda'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
