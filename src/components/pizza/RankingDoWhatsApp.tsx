import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, Send, Smartphone, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { arteDoRanking, enviarRanking, estadoDoRanking, ligarRanking, type EnvioDoRanking, type EstadoDoRanking } from '@/lib/pizza/api';

/**
 * "Ranking para o WhatsApp" (11/11/2026): a arte e a mensagem da disputa da
 * Pizza da Alegria, com os números do momento. Desde a versão com envio
 * automático, as duas vêm da função `pizza-ranking`, a mesma que manda ao
 * grupo ANABRASIL PUBLICAÇÕES às sextas, 15h: o que aparece aqui é o que vai.
 *
 * A comunicação liga o envio automático (nasce desligado), manda um teste
 * para a conversa "Mensagens para mim" do WhatsApp da MKT ou envia ao grupo
 * na hora. O financeiro vê a prévia e os envios.
 */

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const listaDeDatas = (d: string[]) => (d.length > 1 ? `${d.slice(0, -1).map(ddmm).join(', ')} e ${ddmm(d[d.length - 1])}` : d.map(ddmm).join(''));
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
const SITUACAO: Record<EnvioDoRanking['situacao'], { texto: string; cor: string }> = {
  enviado: { texto: 'Enviado', cor: 'text-emerald-700 dark:text-emerald-400' },
  falhou: { texto: 'Falhou', cor: 'text-destructive' },
  pulado: { texto: 'Não enviado', cor: 'text-muted-foreground' },
};

/** Celular: menu de compartilhar (dá para mandar direto ao grupo). Computador: download. */
async function salvarRanking(blob: Blob): Promise<'compartilhado' | 'baixado' | 'cancelado'> {
  const dia = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const arquivo = new File([blob], `ranking-pizza-da-alegria-${dia}.jpg`, { type: 'image/jpeg' });
  const celular = window.matchMedia?.('(pointer: coarse)').matches;
  if (celular && navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: 'Ranking · Pizza da Alegria' }); return 'compartilhado'; }
    catch (e) { if ((e as DOMException)?.name === 'AbortError') return 'cancelado'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = arquivo.name;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'baixado';
}

function EnvioAutomatico({ estado, aoMudar }: { estado: EstadoDoRanking; aoMudar: () => void }) {
  const [ocupado, setOcupado] = useState<'teste' | 'grupo' | 'ligar' | null>(null);
  const [confirmarGrupo, setConfirmarGrupo] = useState(false);
  const pode = estado.podeEnviar && estado.configurado;

  async function enviar(destino: 'teste' | 'grupo') {
    setOcupado(destino); setConfirmarGrupo(false);
    try {
      await enviarRanking(destino);
      toast.success(destino === 'teste' ? 'Teste enviado para "Mensagens para mim", no WhatsApp da MKT.' : `Ranking enviado ao grupo ${estado.grupo}.`);
    } catch (e) { toast.error(`Não foi: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setOcupado(null); aoMudar(); }
  }

  async function ligar(v: boolean) {
    setOcupado('ligar');
    try { await ligarRanking(v); toast.success(v ? 'Envio automático ligado.' : 'Envio automático desligado.'); }
    catch (e) { toast.error(`Não mudou: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setOcupado(null); aoMudar(); }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4" aria-labelledby="envio-automatico">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          <h3 id="envio-automatico" className="font-semibold">Envio automático ao grupo {estado.grupo}</h3>
          <p className="text-sm text-muted-foreground">
            {estado.ligado
              ? <>Toda sexta, às 15h: {listaDeDatas(estado.datas)}.{estado.proximo ? <> Próximo: <strong className="text-foreground">sexta, {ddmm(estado.proximo)}</strong>.</> : ' Não há mais envios.'}</>
              : <>Desligado: nada vai sozinho para o grupo. Ligado, vai toda sexta às 15h ({listaDeDatas(estado.datas)}).</>}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <Switch checked={estado.ligado} onCheckedChange={ligar} disabled={!pode || ocupado !== null} aria-label="Envio automático" />
          {estado.ligado ? 'Ligado' : 'Desligado'}
        </label>
      </div>

      {!estado.configurado && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Falta a conexão com o WhatsApp: o token do Evolution ainda não está na configuração.
        </p>
      )}

      {estado.podeEnviar && (
        <div className="flex flex-col gap-2">
          {confirmarGrupo ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2" role="group" aria-label="Confirmar envio ao grupo">
              <span className="text-sm">Enviar agora para todo o grupo {estado.grupo}?</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmarGrupo(false)}>Cancelar</Button>
                <Button size="sm" onClick={() => enviar('grupo')}>Enviar ao grupo</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => enviar('teste')} disabled={!pode || ocupado !== null}>
                <Smartphone className="h-4 w-4" /> {ocupado === 'teste' ? 'Mandando…' : 'Mandar teste para mim'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmarGrupo(true)} disabled={!pode || ocupado !== null}>
                <Send className="h-4 w-4" /> {ocupado === 'grupo' ? 'Enviando…' : 'Enviar ao grupo agora'}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">O teste vai para a conversa “Mensagens para mim” do WhatsApp da MKT, com a mesma imagem e a mesma mensagem.</p>
        </div>
      )}

      {estado.envios.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Últimos envios</h4>
          <ul className="flex flex-col divide-y text-sm" aria-label="Últimos envios">
            {estado.envios.map((e) => (
              <li key={`${e.criado_em}-${e.destino}`} className="flex flex-col gap-0.5 py-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="tabular-nums">{quando(e.criado_em)}</span>
                  <span className="text-muted-foreground">· {e.destino === 'grupo' ? 'Grupo' : 'Teste para mim'} · {e.origem === 'agendado' ? 'automático' : 'pelo painel'}</span>
                  <span className={`ml-auto font-medium ${SITUACAO[e.situacao].cor}`}>{SITUACAO[e.situacao].texto}</span>
                </div>
                {e.situacao !== 'enviado' && e.detalhe && <p className="break-words text-xs text-muted-foreground">{e.detalhe}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function RankingDoWhatsApp({ vazio }: { vazio: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [arte, setArte] = useState<{ imagem: Blob; mensagem: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDoRanking | null>(null);
  const url = useMemo(() => (arte ? URL.createObjectURL(arte.imagem) : null), [arte]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const lerEstado = useCallback(() => { estadoDoRanking().then(setEstado).catch(() => setEstado(null)); }, []);

  useEffect(() => {
    if (!aberto) return;
    let vale = true;
    setArte(null); setErro(null);
    arteDoRanking()
      .then((a) => { if (vale) setArte(a); })
      .catch((e) => { if (vale) setErro(e instanceof Error ? e.message : String(e)); });
    lerEstado();
    return () => { vale = false; };
  }, [aberto, lerEstado]);

  async function baixar() {
    if (!arte) return;
    try { await salvarRanking(arte.imagem); } catch { toast.error('Não consegui baixar a imagem.'); }
  }

  async function copiar() {
    if (!arte) return;
    try { await navigator.clipboard.writeText(arte.mensagem); toast.success('Mensagem copiada. Cole no grupo junto com a imagem.'); }
    catch { toast.message('Selecione o texto e copie.'); }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)} disabled={vazio}><Trophy className="h-4 w-4" /> Ranking para o WhatsApp</Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] max-w-[880px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ranking para o WhatsApp</DialogTitle>
            <DialogDescription>A disputa entre unidades e pessoas, com os números de agora: a mesma imagem e a mesma mensagem que vão ao grupo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2.5">
              <div className="aspect-[1080/1350] w-full overflow-hidden rounded-lg bg-muted" data-testid="previa-ranking">
                {url ? <img src={url} alt="Arte do ranking da Pizza da Alegria" className="h-full w-full object-cover" />
                  : <div className="grid h-full place-items-center p-4 text-center text-sm text-muted-foreground">{erro ? `Não consegui montar a imagem: ${erro}` : 'Montando o ranking…'}</div>}
              </div>
              <Button onClick={baixar} disabled={!arte}><Download className="h-4 w-4" /> Baixar imagem</Button>
            </div>
            <div className="flex min-w-0 flex-col gap-2.5">
              <label htmlFor="mensagem-ranking" className="text-sm font-semibold">Mensagem para o grupo</label>
              <textarea id="mensagem-ranking" readOnly value={arte?.mensagem ?? ''} placeholder={erro ? '' : 'Montando…'} rows={16} className="w-full resize-none rounded-lg border bg-background p-3 text-sm leading-relaxed" />
              <Button variant="outline" onClick={copiar} disabled={!arte}><Copy className="h-4 w-4" /> Copiar mensagem</Button>
              <p className="text-xs text-muted-foreground">Unidades pelo total de pizzas; no empate, fica à frente quem chegou primeiro. Os campeões são anunciados em 17/12, na Integração dos Funcionários.</p>
            </div>
          </div>
          {estado && <EnvioAutomatico estado={estado} aoMudar={lerEstado} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
